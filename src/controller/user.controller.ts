import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import sendForgotPasswordEmail from '../services/mail/sendForgotPasswordMail';
import userServices from '../services/user.service';
import { TypeRequestBody } from '../types/request.types';
import {
  IEmailVerificationToken,
  IForgotPasswordToken,
} from '../types/token.types';
import { IUser } from '../types/user.types';
import decodeToken from '../utils/token/decodeToken';
import generateAuthToken from '../utils/token/generateAuthToken';
import generateForgotPasswordToken from '../utils/token/generateForgotPasswordToken';
import generateEmailVerificationToken from '../utils/token/generateEmailVerificationToken';
import sendEmailVerificationMail from '../services/mail/sendEmailVerificationMail';

const EXPIRY_DAYS = 180;
const cookieOptions = {
  httpOnly: true,
  maxAge: EXPIRY_DAYS * (24 * 60 * 60 * 1000),
};

const userController = {
  loginUser: async (
    req: TypeRequestBody<{ email?: string; password?: string }>,
    res: Response,
  ) => {
    const email = req.body.email;
    const password = req.body.password;

    // if email or password is undefined
    if (!email || !password) {
      return res.status(401).json({
        message: 'Incorrect Username or Password',
      });
    }

    try {
      const user = await userServices.findUser(email);

      // if no such user found.
      if (!user) {
        return res
          .status(401)
          .json({ message: 'Incorrect Username or Password' });
      }

      // compare the passwords
      const isPasswordCorrect = await bcrypt.compare(password, user.password);

      if (!isPasswordCorrect) {
        return res
          .status(401)
          .json({ message: 'Incorrect Username or Password' });
      }

      // Check if email is verified or not
      if (!user.isEmailVerified) {
        return res.status(401).json({ message: 'Email is not verified' });
      }

      // generate JWT token
      const token = generateAuthToken(user._id, email, false);

      //setting cookie
      res.cookie('token', token, cookieOptions);

      return res.status(200).json({
        message: 'Login Successful',
        user: { username: user.username, email: user.email },
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Something went wrong.....' });
    }
  },

  registerUser: async (
    // defining type of parameters in req.body
    req: TypeRequestBody<{
      username?: string;
      email?: string;
      password?: string;
      branch?: string;
      passingYear?: string;
      designation?: string;
      about?: string;
      github?: string;
      leetcode?: string;
      linkedin?: string;
    }>,
    res: Response,
  ) => {
    // destructing
    const {
      username,
      email,
      password,
      branch,
      passingYear,
      designation,
      about,
      github,
      leetcode,
      linkedin,
    } = req.body;

    // checking if required fields are undefined
    if (
      !username ||
      !email ||
      !password ||
      !branch ||
      !passingYear ||
      !designation ||
      !about
    ) {
      return res
        .status(401)
        .json({ message: 'Please enter all required fields ' });
    }

    try {
      // check if email is registered
      const oldUser = await userServices.findUser(email);

      if (oldUser && oldUser.isEmailVerified) {
        return res.status(404).json({ message: 'Email already exists' });
      }

      if (oldUser && !oldUser.isEmailVerified) {
        await userServices.deleteUser(oldUser._id);
      }

      // Hash the password
      const hashPassword = await bcrypt.hash(password, 12);

      // creating the user(IUser) object
      const userData: IUser = {
        username,
        email,
        password: hashPassword,
        isEmailVerified: false,
        branch,
        passingYear,
        designation,
        about,
        github: github ? github : null,
        leetcode: leetcode ? leetcode : null,
        linkedin: linkedin ? linkedin : null,
      };

      // create user account
      const user = await userServices.createUser(userData);

      // Generate token
      const token = generateEmailVerificationToken(user._id, email, false);

      // send email to the user for verification
      await sendEmailVerificationMail(email, token, user.username);

      return res.status(200).json({
        message: 'Account created successfully, please verify your email....',
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Something went wrong.....' });
    }
  },

  forgotPassword: async (
    req: TypeRequestBody<{ email?: string }>,
    res: Response,
  ) => {
    const email = req.body.email;

    // if email is undefined
    if (!email) {
      return res
        .status(401)
        .json({ message: 'Please enter all required fields ' });
    }

    try {
      // check if email is not-registered
      const user = await userServices.findUser(email);
      if (!user) {
        return res.status(401).json({ message: 'No such email found' });
      }

      // Creating a jwt token and sending it to the user
      const token = generateForgotPasswordToken(user._id, email, false);

      // send email to the user
      sendForgotPasswordEmail(email, token, user.username);

      return res
        .status(200)
        .json({ message: `A password reset link is sent to ${email}` });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Error, Please try again later' });
    }
  },

  resetPassword: async (
    req: TypeRequestBody<{ newPassword?: string }>,
    res: Response,
  ) => {
    const newPassword = req.body.newPassword;
    const resetPasswordToken = req.params['token'];

    if (!newPassword) {
      return res.status(401).json({ message: 'Please enter new Password ' });
    }

    try {
      const tokenData = decodeToken(resetPasswordToken) as IForgotPasswordToken;

      // Check if it is a correct reset password link
      if (tokenData.isAdmin) {
        return res
          .status(401)
          .json({ message: 'Please create a new Reset Password Link' });
      }

      const user = await userServices.findUser(tokenData.email);
      if (!user) {
        return res
          .status(401)
          .json({ message: 'Please create a new Reset Password Link' });
      }

      // Hash the password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Resetting the password
      await userServices.resetPassword(tokenData.email, hashedNewPassword);
      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: 'Error, generate new password link' });
    }
  },
  logoutUser: (req: Request, res: Response) => {
    res.clearCookie('token');
    return res.status(200).json({ message: 'User Logout successful' });
  },
  verifyEmail: async (req: Request, res: Response) => {
    const emailVerificationToken = req.params['token'];

    try {
      const { email, isAdmin } = decodeToken(
        emailVerificationToken,
      ) as IEmailVerificationToken;

      // Check if it is a correct reset password link
      if (isAdmin) {
        return res.status(401).json({ message: 'Please Register Again' });
      }

      const user = await userServices.findUser(email);
      if (!user) {
        return res
          .status(401)
          .json({ message: 'User Not Found with the Email' });
      }

      // Update the user email field
      await userServices.verifyUserEmail(email);

      const CLIENT_BASE_URL = process.env['CLIENT_BASE_URL'];

      if (!CLIENT_BASE_URL) return res.redirect('/');
      return res.redirect(CLIENT_BASE_URL);
    } catch (error) {
      // Send a simple html to user if error
      res.setHeader('Content-type', 'text/html');
      return res.send('<h1>Error Authenticating</h1>');
    }
  },
};

export default userController;
