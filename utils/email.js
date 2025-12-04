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
      <strong>Aahbibi Creators’ Summit – Enugu Edition</strong>.</p>

      <p>This summit isn’t just another event — it’s a movement.</p>

      <p><strong>Location:</strong> Enugu, Nigeria<br/>
      <strong>Date:</strong> ${process.env.EVENT_DATE}<br/>
      <strong>Time:</strong> ${process.env.EVENT_TIME}</p>

      <p>We can’t wait to meet you and see what you’ll create!</p>

      <hr style="margin: 25px 0;">

      <h3>Spread the Word</h3>

      <p>
      “Just signed up for the #AahbibiCreatorsSummit in Enugu!  
      Can’t wait to connect and learn with amazing creators across Africa.  
      Join me at www.aahbibi.com  
      #Aahbibi #CreatorsSummit #Enugu2025 #LearnCreateEarn”
      </p>

      <p>Forward this message to your creative friends and invite them to register now at <a href="https://www.aahbibi.com">www.aahbibi.com</a>.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Aahbibi Creators Summit" <${process.env.EMAIL_USER}>`,
    to,
    subject: "You're In! Aahbibi Creators’ Summit – Enugu",
    html,
  });
};


/**
 * AAHBIBI PLATFORM WELCOME EMAIL
 */
exports.sendAahbibiWelcomeEmail = async (to, firstname) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to Aahbibi — Empowering Creators!</h2>

      <p>Dear ${firstname},</p>

      <p>
        Welcome to <a href="https://www.aahbibi.com">www.Aahbibi.com</a>, the creators’ marketplace for 
        skill acquisition, knowledge sharing, and revenue generation.
      </p>

      <p>
        We are thrilled to have you join this growing community of innovative learners, creators, 
        and educators shaping the future of digital knowledge and entrepreneurship.
      </p>

      <p>
        At Aahbibi, we believe knowledge is power — but shared knowledge is impact.
      </p>

      <p>
        Take your time to explore, enroll in live courses that inspire you, or start building 
        your own community of learners.
      </p>

      <p>
        Thank you for trusting us to be part of your journey.
      </p>

      <p><strong>With appreciation,<br/>Alexander Oseji<br/>Co-Founder, Aahbibi.com</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"Aahbibi Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Welcome to Aahbibi — The Creators' Marketplace",
    html,
  });
};

/**
 * PURCHASE CONFIRMATION EMAIL (to student)
 */
exports.sendPurchaseConfirmationEmail = async (to, firstname, contentTitle, amount) => {
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

      <p><strong>Amount Paid:</strong> ₦${amount.toFixed(2)}</p>

      <p>
        You can access your purchased content anytime from your dashboard at 
        <a href="https://www.aahbibi.com/dashboard">www.aahbibi.com/dashboard</a>.
      </p>

      <p>
        Happy learning!
      </p>

      <p><strong>The Aahbibi Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"Aahbibi Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Purchase Confirmed - ${contentTitle}`,
    html,
  });
};

/**
 * SALE NOTIFICATION EMAIL (to creator)
 */
exports.sendSaleNotificationEmail = async (to, creatorName, contentTitle, studentName, amount) => {
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

      <p><strong>Amount:</strong> ₦${amount.toFixed(2)}</p>

      <p>
        This amount has been added to your wallet. You can view your earnings and withdraw funds 
        from your creator dashboard at <a href="https://www.aahbibi.com/dashboard">www.aahbibi.com/dashboard</a>.
      </p>

      <p>
        Keep creating amazing content!
      </p>

      <p><strong>The Aahbibi Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"Aahbibi Team" <${process.env.EMAIL_USER}>`,
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
        <a href="https://www.aahbibi.com/dashboard">www.aahbibi.com/dashboard</a>.
      </p>

      <p><strong>The Aahbibi Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"Aahbibi Team" <${process.env.EMAIL_USER}>`,
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
        <a href="https://www.aahbibi.com/dashboard">www.aahbibi.com/dashboard</a>.
      </p>

      <p><strong>The Aahbibi Team</strong></p>

      <hr/>
      <em>Empowering Creators. Elevating Knowledge Sharing.</em>
    </div>
  `;

  await transporter.sendMail({
    from: `"Aahbibi Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Withdrawal Failed - Action Required',
    html,
  });
};
