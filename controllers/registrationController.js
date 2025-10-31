// This controller is for the enugu summit sha

const { validationResult } = require('express-validator');
const Registration = require('../models/registrationModel');

exports.register = async (req, res) => {
  const { role, firstname, lastname, email, location } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const existingRegistration = await Registration.findOne({ where: { email } });
    if (existingRegistration) {
      return res.status(400).json({ message: 'This email is already registered.' });
    }

    const newRegistration = await Registration.create({
      role: role || 'Guest',  // Default to 'Guest' if no role provided
      firstname,
      lastname,
      email,
      location,
    });

    res.status(201).json({ message: 'Registration successful', registration: newRegistration });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};


exports.getRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.findAll();

    if (registrations.length === 0) {
      return res.status(404).json({ message: 'No registrations found.' });
    }

    res.json({ registrations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};