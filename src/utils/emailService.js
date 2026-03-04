const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendLoginNotification = async (email, fullName) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log("Email credentials not configured. Skipping notification.");
            return;
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Login Notification - FaceAttend',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px">
                    <h2 style="color: #2563eb;">Hello ${fullName},</h2>
                    <p style="font-size: 16px; color: #4a5568;">Your <strong>FaceAttend</strong> account has just been logged into.</p>
                    <p style="font-size: 14px; color: #718096; margin-top: 20px;">If this wasn't you, please reset your password immediately or contact your administrator.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #a0aec0; text-align: center;">&copy; 2024 FaceAttend Systems Inc.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Login notification sent to ${email}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

const sendPasswordResetEmail = async (email, resetToken) => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log("Email credentials not configured. Skipping password reset email.");
            return;
        }

        const resetUrl = `http://localhost:3000/auth/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request - FaceAttend',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px">
                    <h2 style="color: #2563eb;">Password Reset Request</h2>
                    <p style="font-size: 16px; color: #4a5568;">You requested to reset your password. Click the button below to set a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px;">Reset Password</a>
                    </div>
                    <p style="font-size: 14px; color: #718096;">If you didn't request this, you can safely ignore this email.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #a0aec0; text-align: center;">&copy; 2024 FaceAttend Systems Inc.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
    } catch (error) {
        console.error('Error sending reset email:', error);
    }
};

module.exports = {
    sendLoginNotification,
    sendPasswordResetEmail
};
