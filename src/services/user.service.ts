import { Types } from 'mongoose';
import UserModel from '../models/user.model';

import { IUser } from '../types/user.types';

const userServices = {
  findUser: (email: string) => {
    return UserModel.findOne({ email });
  },

  createUser: (user: IUser) => {
    return UserModel.create(user);
  },

  deleteUser: (id: Types.ObjectId) => {
    return UserModel.deleteOne({ _id: id });
  },

  resetPassword: (email: string, newPassword: string) => {
    return UserModel.findOneAndUpdate({ email }, { password: newPassword });
  },

  verifyUserEmail: (email: string) => {
    return UserModel.findOneAndUpdate({ email }, { isEmailVerified: true });
  },
  getUserProfile: (userId: Types.ObjectId) => {
    return UserModel.aggregate([
      { $match: { _id: userId } },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'userId',
          as: 'postData',
          pipeline: [
            {
              $addFields: {
                upVoteCount: {
                  $size: '$upVotes',
                },
                downVoteCount: {
                  $size: '$downVotes',
                },
              },
            },
            {
              $group: {
                _id: null,
                viewCount: { $sum: '$views' },
                postCount: { $sum: 1 },
                upVoteCount: { $sum: '$upVoteCount' },
                downVoteCount: { $sum: '$downVoteCount' },
              },
            },
          ],
        },
      },
      {
        $project: {
          password: 0,
          isAdmin: 0,
          isEmailVerified: 0,
          'postData._id': 0,
          _id: 0,
        },
      },
    ]);
  },
};

export default userServices;
