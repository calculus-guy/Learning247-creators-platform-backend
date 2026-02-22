const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,       
  port: process.env.EMAIL_PORT,      
  secure: process.env.EMAIL_SECURE == "true",  
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
        rejectUnauthorized: false
    }
});

exports.sendEventRegistrationEmail = async (to, firstname) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>You’re In! Get Ready to Connect, Create & Collaborate at the Creators’ Summit.</h2>

      <p>Dear ${firstname},</p>

      <p>Welcome aboard! You've successfully registered for the 
      <strong>Hallos Creators’ Summit – Enugu Edition</strong>.</p>

      <p>This summit isn’t just another event — it’s a movement.</p>

      <p><strong>Location:</strong> Enugu, Nigeria<br/>
      <strong>Date:</strong> ${process.env.EVENT_DATE}<br/>
      <strong>Time:</strong> ${process.env.EVENT_TIME}</p>

      <p>We can’t wait to meet you and see what you’ll create!</p>

      <hr style="margin: 25px 0;">

      <h3>Spread the Word</h3>

      <p>
      “Just signed up for the #hallosCreatorsSummit in Enugu!  
      Can’t wait to connect and learn with amazing creators across Africa.  
      Join me at www.hallos.com  
      #hallos #CreatorsSummit #Enugu2025 #LearnCreateEarn”
      </p>

      <p>Forward this message to your creative friends and invite them to register now at <a href="https://www.hallos.com">www.hallos.com</a>.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Creators Summit" <${process.env.EMAIL_USER}>`,
    to,
    subject: "You're In! hallos Creators’ Summit – Enugu",
    html,
  });
};


/**
 * hallos PLATFORM WELCOME EMAIL
 */
exports.sendhallosWelcomeEmail = async (to, firstname) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to hallos — Empowering Creators!</h2>

      <p>Dear ${firstname},</p>

      <p>
        Welcome to <a href="https://www.hallos.com">www.hallos.com</a>, the creators’ marketplace for 
        skill acquisition, knowledge sharing, and revenue generation.
      </p>

      <p>
        We are thrilled to have you join this growing community of innovative learners, creators, 
        and educators shaping the future of digital knowledge and entrepreneurship.
      </p>

      <p>
        At hallos, we believe knowledge is power — but shared knowledge is impact.
      </p>

      <p>
        Take your time to explore, enroll in live courses that inspire you, or start building 
        your own community of learners.
      </p>

      <p>
        Thank you for trusting us to be part of your journey.
      </p>

      <p><strong>With appreciation,<br/>Alexander Oseji<br/>Co-Founder, hallos.com</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Welcome to hallos — The Creators' Marketplace",
    html,
  });
};

/**
 * PURCHASE CONFIRMATION EMAIL (to student)
 */
exports.sendPurchaseConfirmationEmail = async (to, firstname, contentTitle, amount, currency = 'NGN') => {
  const currencySymbol = currency === 'USD' ? '$' : '₦';
  const formattedAmount = currency === 'USD' ? amount.toFixed(2) : amount.toLocaleString();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Purchase Confirmed! 🎉</h2>

      <p>Dear ${firstname},</p>

      <p>
        Thank you for your purchase! You now have lifetime access to:
      </p>

      <p style="font-size: 18px; font-weight: bold; color: #333;">
        ${contentTitle}
      </p>

      <p><strong>Amount Paid:</strong> ${currencySymbol}${formattedAmount}</p>

      <p>
        You can access your purchased content anytime from your dashboard at 
        <a href="https://www.hallos.com/dashboard">www.hallos.com/dashboard</a>.
      </p>

      <p>
        Happy learning!
      </p>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Purchase Confirmed - ${contentTitle}`,
    html,
  });
};

/**
 * SALE NOTIFICATION EMAIL (to creator)
 */
exports.sendSaleNotificationEmail = async (to, creatorName, contentTitle, studentName, amount, currency = 'NGN') => {
  const currencySymbol = currency === 'USD' ? '$' : '₦';
  const formattedAmount = currency === 'USD' ? amount.toFixed(2) : amount.toLocaleString();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>You Made a Sale! 💰</h2>

      <p>Dear ${creatorName},</p>

      <p>
        Great news! <strong>${studentName}</strong> just purchased your content:
      </p>

      <p style="font-size: 18px; font-weight: bold; color: #333;">
        ${contentTitle}
      </p>

      <p><strong>Amount:</strong> ${currencySymbol}${formattedAmount}</p>

      <p>
        This amount has been added to your wallet. You can view your earnings and withdraw funds 
        from your creator dashboard at <a href="https://www.hallos.com/dashboard">www.hallos.com/dashboard</a>.
      </p>

      <p>
        Keep creating amazing content!
      </p>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: `New Sale - ${contentTitle}`,
    html,
  });
};

/**
 * WITHDRAWAL CONFIRMATION EMAIL (to creator)
 */
exports.sendWithdrawalConfirmationEmail = async (to, firstname, amount, netAmount, bankName, accountNumber) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Withdrawal Successful! ✅</h2>

      <p>Dear ${firstname},</p>

      <p>
        Your withdrawal request has been processed successfully!
      </p>

      <p><strong>Withdrawal Amount:</strong> ₦${amount.toFixed(2)}</p>
      <p><strong>Platform Fee (20%):</strong> ₦${(amount * 0.20).toFixed(2)}</p>
      <p><strong>Net Amount Transferred:</strong> ₦${netAmount.toFixed(2)}</p>

      <p><strong>Bank Details:</strong></p>
      <p>
        ${bankName}<br/>
        ${accountNumber}
      </p>

      <p>
        The funds should reflect in your account within 1-3 business days.
      </p>

      <p>
        You can view your transaction history in your creator dashboard at 
        <a href="https://www.hallos.com/dashboard">www.hallos.com/dashboard</a>.
      </p>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Withdrawal Successful',
    html,
  });
};

/**
 * WITHDRAWAL FAILURE EMAIL (to creator)
 */
exports.sendWithdrawalFailureEmail = async (to, firstname, amount, reason) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Withdrawal Failed ❌</h2>

      <p>Dear ${firstname},</p>

      <p>
        Unfortunately, your withdrawal request could not be processed.
      </p>

      <p><strong>Amount:</strong> ₦${amount.toFixed(2)}</p>
      <p><strong>Reason:</strong> ${reason}</p>

      <p>
        The funds have been returned to your available balance. Please check your bank details 
        and try again, or contact our support team for assistance.
      </p>

      <p>
        You can retry the withdrawal from your creator dashboard at 
        <a href="https://www.hallos.com/dashboard">www.hallos.com/dashboard</a>.
      </p>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Withdrawal Failed - Action Required',
    html,
  });
};

/**
 * PASSWORD RESET OTP EMAIL
 */
exports.sendPasswordResetOTP = async (to, firstname, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Password Reset Request 🔐</h2>

      <p>Dear ${firstname},</p>

      <p>
        You requested to reset your password for your hallos account. 
        Use the verification code below to proceed:
      </p>

      <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
        <h1 style="color: #333; font-size: 32px; letter-spacing: 8px; margin: 0;">
          ${otp}
        </h1>
      </div>

      <p><strong>Important:</strong></p>
      <ul>
        <li>This code expires in <strong>10 minutes</strong></li>
        <li>Do not share this code with anyone</li>
        <li>If you didn't request this, please ignore this email</li>
      </ul>

      <p>
        Enter this code on the password reset page to create your new password.
      </p>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Password Reset Code - hallos',
    html,
  });
};

/**
 * WITHDRAWAL CONFIRMATION OTP EMAIL
 */
exports.sendWithdrawalOTP = async (to, firstname, otp, amount, currency, bankAccount) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Withdrawal Confirmation Required 💰</h2>

      <p>Dear ${firstname},</p>

      <p>
        You requested to withdraw <strong>${currency} ${amount.toLocaleString()}</strong> from your hallos wallet.
        For your security, please confirm this withdrawal with the verification code below:
      </p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #333; margin-top: 0;">Withdrawal Details:</h3>
        <p><strong>Amount:</strong> ${currency} ${amount.toLocaleString()}</p>
        <p><strong>Bank Account:</strong> ${bankAccount}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      </div>

      <div style="background-color: #e8f5e8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border: 2px solid #28a745;">
        <h1 style="color: #28a745; font-size: 36px; letter-spacing: 6px; margin: 0;">
          ${otp}
        </h1>
      </div>

      <p><strong>Security Notice:</strong></p>
      <ul>
        <li>This code expires in <strong>10 minutes</strong></li>
        <li>Never share this code with anyone</li>
        <li>If you didn't request this withdrawal, contact support immediately</li>
        <li>Only enter this code on the official hallos website</li>
      </ul>

      <p>
        Enter this code on the withdrawal confirmation page to complete your transaction.
      </p>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0;"><strong>⚠️ Security Tip:</strong> Always verify withdrawal details carefully before confirming.</p>
      </div>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Secure. Trusted. Reliable.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Security" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Withdrawal Confirmation - ${currency} ${amount.toLocaleString()}`,
    html,
  });
};
/**
 * COURSE ENROLLMENT CONFIRMATION EMAIL
 */
exports.sendCourseEnrollmentConfirmationEmail = async (to, firstname, courseTitle, amount, currency, departmentName) => {
  const currencySymbol = currency === 'USD' ? '$' : '₦';
  const formattedAmount = currency === 'USD' ? amount.toFixed(2) : amount.toLocaleString();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Course Enrollment Confirmed! 🎓</h2>

      <p>Dear ${firstname},</p>

      <p>
        Thank you for your enrollment! Your payment has been successfully processed for:
      </p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="color: #333; margin-top: 0;">${courseTitle}</h3>
        <p style="margin: 5px 0;"><strong>Department:</strong> ${departmentName}</p>
        <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ${currencySymbol}${formattedAmount}</p>
        <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 0;"><strong>✅ What's Next?</strong></p>
        <p style="margin: 10px 0 0 0;">Your course login credentials will be sent to this email address within the next few hours. Please keep an eye on your inbox!</p>
      </div>

      <p><strong>Important Information:</strong></p>
      <ul>
        <li>Your enrollment has been confirmed and processed</li>
        <li>Course access credentials will be sent shortly</li>
        <li>Check your spam/junk folder if you don't see the credentials email</li>
        <li>Contact support if you don't receive credentials within 24 hours</li>
      </ul>

      <p>
        We're excited to have you join this learning journey! The course will provide you with 
        valuable skills and knowledge to advance your career and personal development.
      </p>

      <p>
        If you have any questions about your enrollment, please don't hesitate to contact our support team.
      </p>

      <p><strong>The Hallos Team</strong></p>

      <hr/>
      <em>Empowering Learners. Transforming Futures.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"Hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Course Enrollment Confirmed - ${courseTitle}`,
    html,
  });
};

/**
 * LIVE SERIES PURCHASE CONFIRMATION EMAIL
 */
exports.sendLiveSeriesPurchaseEmail = async (to, firstname, seriesTitle, totalSessions, amount, currency, startDate) => {
  const currencySymbol = currency === 'USD' ? '$' : '₦';
  const formattedAmount = currency === 'USD' ? amount.toFixed(2) : amount.toLocaleString();
  const formattedStartDate = new Date(startDate).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Live Series Access Confirmed! 🎉</h2>

      <p>Dear ${firstname},</p>

      <p>
        Congratulations! You now have full access to all sessions in:
      </p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="color: #333; margin-top: 0;">${seriesTitle}</h3>
        <p style="margin: 5px 0;"><strong>Total Sessions:</strong> ${totalSessions} live sessions</p>
        <p style="margin: 5px 0;"><strong>Series Starts:</strong> ${formattedStartDate}</p>
        <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ${currencySymbol}${formattedAmount}</p>
        <p style="margin: 5px 0;"><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p style="margin: 0;"><strong>✅ You're All Set!</strong></p>
        <p style="margin: 10px 0 0 0;">You can now join any live session in this series. View your upcoming sessions and join links from your dashboard.</p>
      </div>

      <p><strong>What You Get:</strong></p>
      <ul>
        <li>Access to all ${totalSessions} live sessions in the series</li>
        <li>Real-time interaction with the instructor</li>
        <li>Q&A opportunities during each session</li>
        <li>Join from any device with internet connection</li>
      </ul>

      <p><strong>How to Join Sessions:</strong></p>
      <ol>
        <li>Log in to your dashboard at <a href="https://www.hallos.com/dashboard">www.hallos.com/dashboard</a></li>
        <li>Go to "My Live Series" or "Upcoming Sessions"</li>
        <li>Click "Join Session" when the session is live</li>
      </ol>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Sessions are only available when the instructor starts them. Make sure to check your schedule and join on time!</p>
      </div>

      <p>
        We're excited to have you in this series! Get ready for an amazing learning experience.
      </p>

      <p><strong>The hallos Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Live Series Access Confirmed - ${seriesTitle}`,
    html,
  });
};