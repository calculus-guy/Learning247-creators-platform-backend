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
