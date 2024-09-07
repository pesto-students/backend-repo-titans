import sgMail from '@sendgrid/mail';
import config from '../config/config.js';

sgMail.setApiKey(config.EMAIL_CONFIG.SENDGRID_API_KEY);

/* reason should be an array 
sendTemplatedEmail('user@example.com', 'resubmission', {
  userName: 'John Doe',
  reasons: [
    'Incomplete business information',
    'Missing required documents',
    'Invalid contact details',
  ],
}); */

/**
 * Send an email using SendGrid
 * @param {string | Array<string>} to - The email address[es] to send the email to
 * @param {string} subject - The subject of the email
 * @param {string} text - The plain text content of the email
 * @param {string} html - The HTML content of the email
 * @returns {Promise<object|null>} - The response from SendGrid or null if an error occurred
 */
const sendEmail = async (to, subject, text, html) => {
  const msg = {
    to,
    from: config.EMAIL_CONFIG.ADMIN_EMAIL,
    subject,
    text,
    html,
  };

  try {
    const response = await sgMail.send(msg);
    return response;
  } catch (error) {
    const errorMessage = error.response ? error.response.body : error.message;
    console.error('Error sending email:', errorMessage);
    return null;
  }
};

/**
 * Example Usage:
 * sendTemplatedEmail('test@example.com', 'welcome', { userName: 'John Doe' });
 * sendTemplatedEmail('test@example.com', 'passwordReset', { userName: 'John Doe', resetLink: 'https://example.com/reset' });
 * sendTemplatedEmail('test@example.com', 'accountVerification', { userName: 'John Doe', verificationLink: 'https://example.com/verify' });
 */

/**
 * Send an email using a template
 * @param {string} to - The email address to send the email to
 * @param {string} templateType - The type of email template to use
 * @param {object} params - The parameters to pass to the email template
 * @returns {Promise<object|null>} - The response from SendGrid or null if an error occurred
 */
export const sendTemplatedEmail = async (to, templateType, params) => {
  const templateFunction = emailTemplates[templateType];
  if (!templateFunction) {
    throw new Error('Unknown template type');
  }

  const template = templateFunction(params);
  return sendEmail(to, template.subject, template.text, template.html);
};

const platFormName = config.GENERAL_CONFIG.PLATFORM_NAME || 'WorkoutWings';
/**
 * Email templates
 */
const emailTemplates = {
  welcome: (params) => ({
    subject: `Welcome to ${platFormName}!`,
    text: `Hello ${params.userName},
            Welcome to ${platFormName}! We're thrilled to have you join our community.
            If you have any questions or need assistance, feel free to reach out. We’re here to help!
            Best regards,
            The ${platFormName} Team`,
    html: `
            <h1>Hello, ${params.userName}!</h1>
            <p>Welcome to ${platFormName}! We're thrilled to have you join our community.</p>
            <p>If you have any questions or need assistance, feel free to reach out. We’re here to help!</p>
            <p>Best regards,<br>Your ${platFormName} Team</p>`,
  }),
  passwordReset: (params) => ({
    subject: 'Password Reset Request',
    text: `
            Hi ${params.userName},
            We received a request to reset your password. To proceed, please click the following link:
            ${params.resetLink}
            If you didn't request this password reset, please ignore this email.
            Best regards,
            The ${platFormName} Team`,
    html: `
            <h1>Password Reset Request</h1>
            <p>Hi ${params.userName},</p>
            <p>We received a request to reset your password. To proceed, please click the button below:</p>
            <a href="${params.resetLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007BFF; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>Best regards,<br>${platFormName} Team</p>`,
  }),
  accountVerification: (params) => ({
    subject: 'Verify Your Account',
    text: `
            Hi ${params.userName},
            Thank you for registering with ${platFormName}!
            To complete your registration, please verify your account by clicking the following link:
            ${params.verificationLink}
            If you didn't register for an account with us, please ignore this email.
            Best regards,
            The ${platFormName} Team`,
    html: `
            <h1>Verify Your Account</h1>
            <p>Hi ${params.userName},</p>
            <p>Thank you for registering with ${platFormName}!</p>
            <p>To complete your registration, please verify your account by clicking the button below:</p>
            <a href="${params.verificationLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #28a745; text-decoration: none; border-radius: 5px;">Verify Account</a>
            <p>If you didn't register for an account with us, please ignore this email.</p>
            <p>Best regards,<br>The ${platFormName} Team</p>`,
  }),
  resubmission: (params) => {
    // Ensure reasons is an array, default to an empty array if not provided
    const reasons = Array.isArray(params.reason) ? params.reason : [];

    return {
      subject: 'Resubmission Required: Onboarding Form Declined',
      text: `
                Hi ${params.userName},

                Thank you for your interest in joining ${platFormName}. Unfortunately, we were unable to approve your onboarding form at this time due to the following reasons:

                ${
                  reasons.length > 0
                    ? reasons.map((reason) => `- ${reason}`).join('\n')
                    : 'No reasons provided.'
                }

                We kindly request you to review the listed points and resubmit the form with the necessary corrections.

                If you have any questions or need assistance, feel free to reach out to us.

                Best regards,
                Team ${platFormName} 
              `,
      html: `
                <h1>Resubmission Required: Onboarding Form Declined</h1>
                <p>Hi ${params.userName},</p>
                <p>Thank you for your interest in joining ${platFormName}. Unfortunately, we were unable to approve your onboarding form at this time due to the following reasons:</p>
                <ul>
                  ${
                    reasons.length > 0
                      ? reasons.map((reason) => `<li>${reason}</li>`).join('')
                      : '<li>No reasons provided.</li>'
                  }
                </ul>
                <p>We kindly request you to review the listed points and resubmit the form with the necessary corrections.</p>
                <p>If you have any questions or need assistance, feel free to reach out to us.</p>
                <p>Best regards,<br>Team ${platFormName} </p>
              `,
    };
  },
  approval: (params) => {
    // console.log("inside approve")
    return {
      subject: 'Congratulations! Your Gym is Now Live on Our Platform',
      text: `
            Dear ${params.userName},

            We are delighted to inform you that your gym has been successfully approved and is now live on our platform.

            Your gym's profile is now visible to our growing community of fitness enthusiasts, making it easier for them to discover and book your services. We are excited to have you on board and look forward to working together to help your gym thrive.

            If you have any questions or need assistance with setting up your gym's profile or managing bookings, please don't hesitate to reach out to our dedicated support team.

            We appreciate your trust in our platform and look forward to a long and successful partnership.

            Best regards,
            The ${platFormName} Team
          `,
      html: `
            <h1>Congratulations! Your Gym is Now Live on Our Platform</h1>
            <p>Dear ${params.userName},</p>
            <p>We are delighted to inform you that your gym has been successfully approved and is now live on our platform.</p>
            <p>Your gym's profile is now visible to our growing community of fitness enthusiasts, making it easier for them to discover and book your services. We are excited to have you on board and look forward to working together to help your gym thrive.</p>
            <p>If you have any questions or need assistance with setting up your gym's profile or managing bookings, please don't hesitate to reach out to our dedicated support team.</p>
            <p>We appreciate your trust in our platform and look forward to a long and successful partnership.</p>
            <p>Best regards,<br>The ${platFormName} Team</p>
          `,
    };
  },
};
