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

/**
 * SOCIAL MEDIA FOOTER - Added to all emails
 */
const getSocialFooter = () => {
  return `
    <div style="background-color: #f8f9fa; padding: 25px; margin-top: 30px; border-radius: 8px; text-align: center;">
      <h3 style="color: #333; margin-top: 0;">Stay Connected With Us!</h3>
      
      <div style="margin: 20px 0;">
        <a href="https://www.linkedin.com/company/106357438/" style="margin: 0 10px; text-decoration: none;">
          <img src="https://img.icons8.com/color/48/000000/linkedin.png" alt="LinkedIn" style="width: 32px; height: 32px;"/>
        </a>
        <a href="https://web.facebook.com/profile.php?id=61573028903471" style="margin: 0 10px; text-decoration: none;">
          <img src="https://img.icons8.com/color/48/000000/facebook.png" alt="Facebook" style="width: 32px; height: 32px;"/>
        </a>
        <a href="https://www.instagram.com/learning247live/" style="margin: 0 10px; text-decoration: none;">
          <img src="https://img.icons8.com/color/48/000000/instagram-new.png" alt="Instagram" style="width: 32px; height: 32px;"/>
        </a>
        <a href="https://www.tiktok.com/@learning247live?lang=en" style="margin: 0 10px; text-decoration: none;">
          <img src="https://img.icons8.com/color/48/000000/tiktok.png" alt="TikTok" style="width: 32px; height: 32px;"/>
        </a>
        <a href="https://x.com/Learning247Live" style="margin: 0 10px; text-decoration: none;">
          <img src="https://img.icons8.com/color/48/000000/twitter.png" alt="X (Twitter)" style="width: 32px; height: 32px;"/>
        </a>
        <a href="https://whatsapp.com/channel/0029VbAuQCzGpLHXVDV17t3u" style="margin: 0 10px; text-decoration: none;">
          <img src="https://img.icons8.com/color/48/000000/whatsapp.png" alt="WhatsApp Channel" style="width: 32px; height: 32px;"/>
        </a>
      </div>

      <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>📞 Need Help?</strong><br/>
          WhatsApp Support: <a href="https://wa.me/2347074119865" style="color: #25D366; text-decoration: none; font-weight: bold;">+234 707 411 9865</a>
        </p>
      </div>

      <p style="color: #666; font-size: 14px; margin: 15px 0;">
        Join our WhatsApp channel for exclusive updates, free resources every Thursday, and learning tips!
      </p>
    </div>

    <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;"/>
    <p style="text-align: center; color: #666; font-size: 12px;">
      <em>Empowering Creators. Elevating Knowledge Sharing.</em><br/>
      © ${new Date().getFullYear()} hallos. All rights reserved.
    </p>
  `;
};

exports.sendEventRegistrationEmail = async (to, firstname) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>You're In! Get Ready to Connect, Create & Collaborate at the Creators' Summit.</h2>

      <p>Dear ${firstname},</p>

      <p>Welcome aboard! You've successfully registered for the 
      <strong>Hallos Creators' Summit – Enugu Edition</strong>.</p>

      <p>This summit isn't just another event — it's a movement.</p>

      <p><strong>Location:</strong> Enugu, Nigeria<br/>
      <strong>Date:</strong> ${process.env.EVENT_DATE}<br/>
      <strong>Time:</strong> ${process.env.EVENT_TIME}</p>

      <p>We can't wait to meet you and see what you'll create!</p>

      <hr style="margin: 25px 0;">

      <h3>Spread the Word</h3>

      <p>
      "Just signed up for the #hallosCreatorsSummit in Enugu!  
      Can't wait to connect and learn with amazing creators across Africa.  
      Join me at www.hallos.net  
      #hallos #CreatorsSummit #Enugu2025 #LearnCreateEarn"
      </p>

      <p>Forward this message to your creative friends and invite them to register now at <a href="https://www.hallos.net">www.hallos.net</a>.</p>
      
      ${getSocialFooter()}
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Creators Summit" <${process.env.EMAIL_USER}>`,
    to,
    subject: "You're In! hallos Creators' Summit – Enugu",
    html,
  });
};


/**
 * hallos PLATFORM WELCOME EMAIL - UPDATED
 */
exports.sendhallosWelcomeEmail = async (to, firstname) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to hallos! 🎉</h1>
      </div>

      <div style="padding: 30px; background-color: #ffffff;">
        <p style="font-size: 18px; color: #333;">Hi ${firstname},</p>

        <p style="font-size: 16px; line-height: 1.8; color: #555;">
          Welcome to <strong>hallos</strong> — Africa's fastest-growing creators' marketplace for 
          skill acquisition, knowledge sharing, and revenue generation!
        </p>

        <p style="font-size: 16px; line-height: 1.8; color: #555;">
          We're thrilled to have you join thousands of innovative learners, creators, and educators 
          who are shaping the future of digital knowledge and entrepreneurship.
        </p>

        <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
          <h3 style="color: #333; margin-top: 0;">🚀 What You Can Do on hallos:</h3>
          
          <ul style="color: #555; line-height: 2;">
            <li><strong>📚 Self-Paced Courses:</strong> Learn at your own pace with our comprehensive course library</li>
            <li><strong>🎥 Live Classes:</strong> Join interactive live sessions with expert instructors</li>
            <li><strong>📅 Live Series:</strong> Enroll in multi-week learning programs with scheduled sessions</li>
            <li><strong>✅ Quizzes & Assessments:</strong> Test your knowledge and track your progress</li>
            <li><strong>🎁 Free Resources:</strong> Access free learning materials dropped every Thursday!</li>
            <li><strong>💰 Earn as a Creator:</strong> Share your knowledge and monetize your expertise</li>
          </ul>
        </div>

        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
          <h3 style="color: #333; margin-top: 0;">🎁 Don't Miss Our Weekly Freebies!</h3>
          <p style="color: #555; margin: 10px 0;">
            Every <strong>Thursday</strong>, we drop exclusive free learning materials, templates, and resources 
            to help you grow. Make sure to check the platform weekly!
          </p>
        </div>

        <div style="text-align: center; margin: 35px 0;">
          <a href="https://www.hallos.net" style="background-color: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; font-size: 16px;">
            Start Exploring Now
          </a>
        </div>

        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #28a745;">
          <h3 style="color: #333; margin-top: 0;">💡 Share the Knowledge!</h3>
          <p style="color: #555; margin: 10px 0;">
            Love what we're building? Invite your friends and family to join hallos! 
            Together, we're creating Africa's largest learning community.
          </p>
          <p style="color: #555; margin: 10px 0;">
            <strong>Share this link:</strong> <a href="https://www.hallos.net" style="color: #667eea;">www.hallos.net</a>
          </p>
        </div>

        <p style="font-size: 16px; line-height: 1.8; color: #555; margin-top: 30px;">
          At hallos, we believe <strong>knowledge is power</strong> — but <strong>shared knowledge is impact</strong>.
        </p>

        <p style="font-size: 16px; line-height: 1.8; color: #555;">
          Take your time to explore, enroll in courses that inspire you, or start building 
          your own community of learners as a creator.
        </p>

        <p style="font-size: 16px; line-height: 1.8; color: #555;">
          Thank you for trusting us to be part of your learning journey. Let's grow together! 🌱
        </p>

        <p style="font-size: 16px; margin-top: 30px;">
          <strong>With appreciation,</strong><br/>
          <strong>Alexander Oseji</strong><br/>
          Co-Founder, hallos
        </p>
      </div>

      ${getSocialFooter()}
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Welcome to hallos — Let's Start Your Learning Journey! 🚀",
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
        <a href="https://www.hallos.net/dashboard">www.hallos.net/dashboard</a>.
      </p>

      <p>
        Happy learning!
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
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
        from your creator dashboard at <a href="https://www.hallos.net/dashboard">www.hallos.net/dashboard</a>.
      </p>

      <p>
        Keep creating amazing content!
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
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
        <a href="https://www.hallos.net/dashboard">www.hallos.net/dashboard</a>.
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
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
        <a href="https://www.hallos.net/dashboard">www.hallos.net/dashboard</a>.
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
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

      ${getSocialFooter()}
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

      ${getSocialFooter()}
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

      ${getSocialFooter()}
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
        <li>Log in to your dashboard at <a href="https://www.hallos.net/dashboard">www.hallos.net/dashboard</a></li>
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

      ${getSocialFooter()}
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Team" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Live Series Access Confirmed - ${seriesTitle}`,
    html,
  });
};

/**
 * SESSION REMINDER EMAIL (1 hour before)
 */
exports.sendSessionReminderEmail = async (to, firstname, sessionData) => {
  const { sessionId, seriesId, sessionNumber, seriesTitle, scheduledStartTime, thumbnailUrl } = sessionData;
  
  const startTime = new Date(scheduledStartTime);
  const formattedDate = startTime.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = startTime.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // Use seriesId if provided, otherwise fall back to sessionId
  const joinUrl = seriesId 
    ? `${process.env.CLIENT_URL}/series/${seriesId}`
    : `${process.env.CLIENT_URL}/session/${sessionId}/join`;
  const calendarUrl = `${process.env.CLIENT_URL}/session/${sessionId}/calendar`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Your Live Session Starts in 1 Hour! ⏰</h2>

      <p>Hi ${firstname},</p>

      <p>
        This is a friendly reminder that your live session is starting soon!
      </p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
        <h3 style="color: #333; margin-top: 0;">${seriesTitle}</h3>
        <p style="margin: 5px 0;"><strong>Session ${sessionNumber}</strong></p>
        <p style="margin: 5px 0;">📅 ${formattedDate}</p>
        <p style="margin: 5px 0;">⏰ ${formattedTime}</p>
      </div>

      ${thumbnailUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <img src="${thumbnailUrl}" alt="${seriesTitle}" style="max-width: 100%; height: auto; border-radius: 8px;" />
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${joinUrl}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Join Session Now
        </a>
      </div>

      <p style="text-align: center; margin: 20px 0;">
        <a href="${calendarUrl}" style="color: #007bff; text-decoration: none;">
          📅 Add to Calendar
        </a>
      </p>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Join a few minutes early to test your connection and get settled!</p>
      </div>

      <p><strong>What to Prepare:</strong></p>
      <ul>
        <li>Stable internet connection</li>
        <li>Headphones or speakers</li>
        <li>Notebook for taking notes</li>
        <li>Any questions you want to ask</li>
      </ul>

      <p>
        See you in the session!
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Reminders" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Starting Soon: ${seriesTitle} - Session ${sessionNumber}`,
    html,
  });
};

/**
 * NEW CONTENT NEWSLETTER EMAIL
 */
exports.sendNewContentEmail = async (to, firstname, contentData) => {
  const { id, title, description, thumbnailUrl, contentType, pricing, creatorName } = contentData;
  
  const contentTypeLabel = {
    'video': 'New Video',
    'live_class': 'New Live Class',
    'live_series': 'New Live Series'
  }[contentType] || 'New Content';

  const viewUrl = `${process.env.CLIENT_URL}/${contentType}/${id}`;
  const unsubscribeUrl = `${process.env.CLIENT_URL}/profile/notifications`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>🎉 ${contentTypeLabel} Available Now!</h2>

      <p>Hi ${firstname},</p>

      <p>
        Great news! New content has just been added to hallos that you might be interested in:
      </p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${thumbnailUrl ? `
        <div style="text-align: center; margin-bottom: 15px;">
          <img src="${thumbnailUrl}" alt="${title}" style="max-width: 100%; height: auto; border-radius: 8px;" />
        </div>
        ` : ''}
        
        <h3 style="color: #333; margin-top: 0;">${title}</h3>
        ${creatorName ? `<p style="color: #666; margin: 5px 0;">By ${creatorName}</p>` : ''}
        ${description ? `<p style="margin: 10px 0;">${description.substring(0, 200)}${description.length > 200 ? '...' : ''}</p>` : ''}
        
        ${pricing ? `
        <div style="margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Price:</strong></p>
          <p style="margin: 5px 0;">₦${pricing.ngn.toLocaleString()} NGN or $${pricing.usd.toFixed(2)} USD</p>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${viewUrl}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          View ${contentTypeLabel}
        </a>
      </div>

      <p>
        Don't miss out on this opportunity to learn something new!
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;"/>

      <p style="font-size: 12px; color: #666;">
        You're receiving this email because you subscribed to hallos newsletter. 
        <a href="${unsubscribeUrl}" style="color: #007bff;">Manage your notification preferences</a>
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Newsletter" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${contentTypeLabel}: ${title}`,
    html,
  });
};

/**
 * COLLABORATION REQUEST EMAIL (to company)
 * Sent when a user requests collaboration with a company
 * CC'd to the user who sent the request
 */
exports.sendCollaborationRequestEmail = async (companyEmail, userEmail, collaborationData) => {
  const { 
    companyName, 
    contactName, 
    userFullName, 
    userFirstName,
    message 
  } = collaborationData;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Collaboration Opportunity</h1>
      </div>

      <div style="padding: 30px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #333;">Dear ${contactName || 'Team'},</p>

        <p style="font-size: 15px; line-height: 1.8; color: #555;">
          I hope this email finds you well. My name is <strong>${userFullName}</strong>, and I am a content creator on the <strong>Hallos</strong> platform.
        </p>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
          <p style="font-size: 15px; line-height: 1.8; color: #333; margin: 0;">
            ${message}
          </p>
        </div>

        <p style="font-size: 15px; line-height: 1.8; color: #555;">
          I believe a collaboration between us would be mutually beneficial, and I would love to discuss how we can work together to create engaging content that resonates with your audience.
        </p>

        <p style="font-size: 15px; line-height: 1.8; color: #555;">
          I am available for a call or meeting at your convenience to explore this opportunity further.
        </p>

        <p style="font-size: 15px; line-height: 1.8; color: #555;">
          Looking forward to hearing from you.
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef;">
          <p style="font-size: 15px; margin: 5px 0;"><strong>Best regards,</strong></p>
          <p style="font-size: 15px; margin: 5px 0;"><strong>${userFullName}</strong></p>
          <p style="font-size: 14px; margin: 5px 0; color: #666;">
            📧 Email: <a href="mailto:${userEmail}" style="color: #667eea; text-decoration: none;">${userEmail}</a>
          </p>
          <p style="font-size: 14px; margin: 5px 0; color: #666;">
            🌐 Platform: <a href="https://www.hallos.net" style="color: #667eea; text-decoration: none;">Hallos (www.hallos.net)</a>
          </p>
        </div>

        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 25px 0; text-align: center;">
          <p style="margin: 0; color: #333; font-size: 14px;">
            <strong>💡 About Hallos:</strong> Africa's fastest-growing creators' marketplace for skill acquisition, knowledge sharing, and revenue generation.
          </p>
        </div>
      </div>

      ${getSocialFooter()}
    </div>
  `;

  // Send email to company with CC to user
  await transporter.sendMail({
    from: `"${userFullName} via Hallos" <${process.env.EMAIL_USER}>`,
    to: companyEmail,
    cc: userEmail, // CC the user
    replyTo: userEmail, // Company can reply directly to user
    subject: `Collaboration Opportunity with ${userFullName} - Content Creator on Hallos`,
    html,
  });
};


/**
 * SESSION RECORDING EMAIL
 * Sends recording links to enrolled students
 */
exports.sendSessionRecordingEmail = async (to, firstname, recordingData) => {
  const { seriesTitle, recordings, customMessage, thumbnailUrl } = recordingData;
  
  // Build recordings list HTML
  const recordingsHtml = recordings.map(rec => `
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #007bff;">
      <h4 style="color: #333; margin-top: 0;">Session ${rec.sessionNumber}</h4>
      <div style="text-align: center; margin: 15px 0;">
        <a href="${rec.driveLink}" style="background-color: #4285f4; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          📹 Watch Recording
        </a>
      </div>
    </div>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Session Recording Available! 🎥</h2>

      <p>Hi ${firstname},</p>

      <p>
        Great news! The recording${recordings.length > 1 ? 's' : ''} for your live session${recordings.length > 1 ? 's are' : ' is'} now available.
      </p>

      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
        <h3 style="color: #333; margin-top: 0;">${seriesTitle}</h3>
        <p style="margin: 5px 0;">You can now watch the recording${recordings.length > 1 ? 's' : ''} at your convenience!</p>
      </div>

      ${thumbnailUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <img src="${thumbnailUrl}" alt="${seriesTitle}" style="max-width: 100%; height: auto; border-radius: 8px;" />
      </div>
      ` : ''}

      ${customMessage ? `
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0;"><strong>Message from your instructor:</strong></p>
        <p style="margin: 10px 0 0 0;">${customMessage}</p>
      </div>
      ` : ''}

      <h3>Available Recordings:</h3>
      ${recordingsHtml}

      <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
        <p style="margin: 0;"><strong>📝 How to Access:</strong></p>
        <ol style="margin: 10px 0 0 0;">
          <li>Click the "Watch Recording" button above</li>
          <li>You'll be redirected to Google Drive</li>
          <li>Stream or download the recording</li>
          <li>Watch at your own pace and take notes</li>
        </ol>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Rewatch the session to reinforce your learning and catch any details you might have missed!</p>
      </div>

      <p><strong>Need Help?</strong></p>
      <p>
        If you have any issues accessing the recording${recordings.length > 1 ? 's' : ''}, please contact our support team 
        via WhatsApp at <a href="https://wa.me/2347074119865" style="color: #25D366; text-decoration: none; font-weight: bold;">+234 707 411 9865</a>
      </p>

      <p>
        Keep learning and growing!
      </p>

      <p><strong>The hallos Team</strong></p>

      ${getSocialFooter()}
    </div>
  `;

  await transporter.sendMail({
    from: `"hallos Recordings" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Session Recording Available - ${seriesTitle}`,
    html,
  });
};
