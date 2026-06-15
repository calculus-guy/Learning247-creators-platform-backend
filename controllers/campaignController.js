const { paystackClient } = require('../config/paystack');
const CampaignRegistration = require('../models/CampaignRegistration');
const { sendCampaignRegistrationConfirmationEmail } = require('../utils/email');

const CAMPAIGN_AMOUNT_NGN = 3000;        // ₦3,000
const CAMPAIGN_AMOUNT_KOBO = 300000;     // in kobo

/**
 * Register for the Hallos Fastrack Retreat campaign
 * POST /api/campaigns/register
 *
 * Body: { firstName, lastName, email, phoneNumber, location, talent, jobDescription, whatToLearn }
 * Returns: { authorizationUrl, reference } for Paystack redirect
 */
exports.registerForCampaign = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      location,
      talent,
      jobDescription,
      whatToLearn
    } = req.body;

    // Validate required fields
    const missing = [];
    if (!firstName)    missing.push('firstName');
    if (!lastName)     missing.push('lastName');
    if (!email)        missing.push('email');
    if (!phoneNumber)  missing.push('phoneNumber');
    if (!location)     missing.push('location');
    if (!talent)       missing.push('talent');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Prevent duplicate completed registrations on the same email
    const existingCompleted = await CampaignRegistration.findOne({
      where: { email: email.toLowerCase().trim(), paymentStatus: 'completed' }
    });

    if (existingCompleted) {
      return res.status(409).json({
        success: false,
        message: 'This email address has already registered and paid for the campaign.',
        alreadyRegistered: true
      });
    }

    // Generate a unique reference for this transaction
    const reference = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create a pending registration record before calling Paystack
    const registration = await CampaignRegistration.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      location: location.trim(),
      talent: talent.trim(),
      jobDescription: jobDescription ? jobDescription.trim() : null,
      whatToLearn: whatToLearn ? whatToLearn.trim() : null,
      paymentReference: reference,
      paymentStatus: 'pending',
      paymentGateway: 'paystack',
      amount: CAMPAIGN_AMOUNT_NGN,
      currency: 'NGN'
    });

    // Initialize Paystack transaction
    const paystackResponse = await paystackClient.post('/transaction/initialize', {
      email: registration.email,
      amount: CAMPAIGN_AMOUNT_KOBO,
      currency: 'NGN',
      reference,
      metadata: {
        type: 'campaign_registration',
        registrationId: registration.id,
        firstName: registration.firstName,
        lastName: registration.lastName,
        phoneNumber: registration.phoneNumber,
        location: registration.location,
        talent: registration.talent
      }
    });

    const { authorization_url, access_code } = paystackResponse.data.data;

    return res.status(200).json({
      success: true,
      message: 'Registration initiated. Complete your payment to confirm your spot.',
      authorizationUrl: authorization_url,
      accessCode: access_code,
      reference,
      registrationId: registration.id
    });
  } catch (error) {
    console.error('[Campaign] Register error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate campaign registration. Please try again.'
    });
  }
};

/**
 * Verify campaign payment after Paystack redirect
 * POST /api/campaigns/verify/:reference
 *
 * Call this from the frontend after Paystack redirects back.
 * Idempotent — safe to call multiple times.
 */
exports.verifyCampaignPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Payment reference is required' });
    }

    // Find the registration
    const registration = await CampaignRegistration.findOne({ where: { paymentReference: reference } });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found for this reference' });
    }

    // Already confirmed — return cached result
    if (registration.paymentStatus === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Payment already confirmed. Welcome to the retreat!',
        alreadyProcessed: true,
        registration: {
          id: registration.id,
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          paymentStatus: registration.paymentStatus
        }
      });
    }

    // Verify with Paystack
    const paystackResponse = await paystackClient.get(`/transaction/verify/${reference}`);
    const txData = paystackResponse.data.data;

    if (!paystackResponse.data.status || txData.status !== 'success') {
      // Mark as failed
      await registration.update({ paymentStatus: 'failed' });
      return res.status(400).json({
        success: false,
        message: `Payment not successful. Paystack status: ${txData.status}`
      });
    }

    // Confirm registration
    await registration.update({ paymentStatus: 'completed' });

    // Send confirmation email (fire-and-forget, non-blocking)
    if (!registration.emailSent) {
      sendCampaignRegistrationConfirmationEmail(
        registration.email,
        registration.firstName,
        {
          lastName: registration.lastName,
          talent: registration.talent,
          location: registration.location
        }
      )
        .then(() => registration.update({ emailSent: true }))
        .catch(err => console.error('[Campaign] Confirmation email failed:', err.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed! Check your email for retreat details.',
      registration: {
        id: registration.id,
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        paymentStatus: 'completed'
      }
    });
  } catch (error) {
    console.error('[Campaign] Verify payment error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment. Please contact support.'
    });
  }
};

/**
 * Get all campaign registrations (admin only)
 * GET /api/campaigns/registrations
 * Query: ?status=completed&page=1&limit=50
 */
exports.getRegistrations = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status && ['pending', 'completed', 'failed'].includes(status)) {
      where.paymentStatus = status;
    }

    const result = await CampaignRegistration.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phoneNumber',
        'location', 'talent', 'jobDescription', 'whatToLearn',
        'paymentStatus', 'amount', 'currency', 'paymentReference',
        'emailSent', 'createdAt'
      ]
    });

    return res.status(200).json({
      success: true,
      total: result.count,
      page: parseInt(page),
      limit: parseInt(limit),
      registrations: result.rows
    });
  } catch (error) {
    console.error('[Campaign] Get registrations error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch registrations' });
  }
};
