const nodemailer = require("nodemailer");

// Create transporter
const createTransporter = async () => {
  // Use Ethereal Email for development/testing
  // if (process.env.NODE_ENV !== "production") {
  //   try {
  //     const testAccount = await nodemailer.createTestAccount();
  //     return nodemailer.createTransport({
  //       host: "smtp.ethereal.email",
  //       port: 587,
  //       secure: false,
  //       auth: {
  //         user: testAccount.user,
  //         pass: testAccount.pass,
  //       },
  //     });
  //   } catch (error) {
  //     console.log("Ethereal failed, falling back to Gmail...");
  //   }
  // }

  // Production Gmail configuration
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER || "noreply@cypher-sentinel.com",
      to: email,
      subject: "Email Verification OTP",
      html: `
        <div style="background:#f4f6f8;padding:30px 0;">
    <div style="
      max-width:520px;
      margin:auto;
      background:#ffffff;
      border-radius:12px;
      box-shadow:0 10px 30px rgba(0,0,0,0.08);
      overflow:hidden;
      font-family:'Segoe UI',Roboto,Arial,sans-serif;
    ">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);
        padding:24px;
        text-align:center;
        color:#ffffff;">
        <h1 style="margin:0;font-size:22px;letter-spacing:1px;">
          Cypher Sentinel
        </h1>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">
          Secure Email Verification
        </p>
      </div>

      <!-- Body -->
      <div style="padding:30px;text-align:center;">
        <h2 style="margin-top:0;color:#333;font-size:20px;">
          Verify Your Email Address
        </h2>

        <p style="color:#555;font-size:14px;line-height:1.6;">
          Please use the OTP below to complete your email verification.
          This code is valid for <strong>5 minutes</strong>.
        </p>

        <!-- OTP Box -->
        <div style="
          margin:24px auto;
          display:inline-block;
          padding:16px 28px;
          font-size:32px;
          letter-spacing:6px;
          font-weight:600;
          color:#2c5364;
          background:#f0f4f8;
          border-radius:10px;
          border:1px dashed #2c5364;
        ">
          ${otp}
        </div>

        <p style="color:#888;font-size:13px;margin-top:20px;">
          If you didn’t request this OTP, you can safely ignore this email.
        </p>
      </div>

      <!-- Footer -->
      <div style="
        background:#f8f9fa;
        padding:16px;
        text-align:center;
        font-size:12px;
        color:#999;
      ">
        © ${new Date().getFullYear()} Cypher Sentinel · All rights reserved
      </div>

    </div>
  </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    // Show preview URL in development
    // if (
    //   process.env.NODE_ENV !== "production" &&
    //   nodemailer.getTestMessageUrl(info)
    // ) {
    //   console.log("📧 Preview URL:", nodemailer.getTestMessageUrl(info));
    // }

    return true;
  } catch (error) {
    console.error("Error sending email:", error.message);
    return false;
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
