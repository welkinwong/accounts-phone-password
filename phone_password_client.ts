import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { check } from 'meteor/check';
import { SHA256 } from 'meteor/sha';

// Used in the various functions below to handle errors consistently
const reportError = (error: Error, callback?: (error: any) => void) => {
  if (callback) {
    callback(error);
  } else {
    throw error;
  }
};

// Attempt to log in with phone and password.

/**
 * @summary Log the user in with a password.
 * @locus   Client
 * @param   selector Either a string interpreted as a phone; or an object with a single key: `phone` or `id`.
 * @param   password The user's password.
 * @param   [callback] Optional callback. Called with no arguments on success, or with a single `Error` argument on failure.
 */
Meteor.loginWithPhoneAndPassword = (selector, password, callback) => {
  if (typeof selector === 'string') selector = { phone: selector };

  Accounts.callLoginMethod({
    methodArguments: [{ user: selector, password: Accounts._hashPassword(password) }],
    userCallback: error => {
      if (error) {
        callback && callback(error);
      } else {
        callback && callback();
      }
    },
  });
};

Accounts._hashPassword = password => ({
  digest: SHA256(password),
  algorithm: 'sha-256',
});

// Sends an sms to a user with a code to verify his number.

/**
 * @summary       Request a new verification code.
 * @locus         Client
 * @param phone   The phone we send the verification code to.
 * @param         [callback] Optional callback. Called with no arguments on success, or with a single `Error` argument on failure.
 */
Accounts.requestPhoneVerification = (phone, callback) => {
  if (!phone) throw new Error('Must pass phone');

  // @ts-expect-error
  Accounts.connection.call('requestPhoneVerification', phone, callback);
};

// Verify phone number
// Based on a code ( received by SMS ) originally created by
// Accounts.verifyPhone, optionally change password and then logs in the matching user.

/**
 * @summary Marks the user's phone as verified. Optional change passwords, Logs the user in afterwards..
 * @locus Client
 * @param phone The phone number we want to verify.
 * @param code The code retrieved in the SMS.
 * @param newPassword, Optional, A new password for the user. This is __not__ sent in plain text over the wire.
 * @param [callback] Optional callback. Called with no arguments on success, or with a single `Error` argument on failure.
 */
Accounts.verifyPhone = (phone, code, newPassword, callback) => {
  check(code, String);
  check(phone, String);
  check(newPassword, Match.Maybe(Match.OneOf(String, Function)));

  let hashedPassword;

  if (newPassword) {
    // If didn't gave newPassword and only callback was given
    if (typeof newPassword === 'function') {
      callback = newPassword;
    } else {
      check(newPassword, String);
      hashedPassword = Accounts._hashPassword(newPassword);
    }
  }

  Accounts.callLoginMethod({
    methodName: 'verifyPhone',
    methodArguments: [phone, code, hashedPassword],
    userCallback: callback,
  });
};

/**
 * Returns whether the current user phone is verified
 * @returns Whether the user phone is verified
 */
Accounts.isPhoneVerified = () => {
  var me = Meteor.user();
  return !!(me && me.phone && me.phone.verified);
};

// Change password. Must be logged in.
//
// @param oldPassword {String|null} By default servers no longer allow
//   changing password without the old password, but they could so we
//   support passing no password to the server and letting it decide.
// @param newPassword {String}
// @param callback {Function(error|undefined)}

/**
 * @summary Change the current user's password. Must be logged in.
 * @locus Client
 * @param oldPassword The user's current password. This is __not__ sent in plain text over the wire.
 * @param newPassword A new password for the user. This is __not__ sent in plain text over the wire.
 * @param [callback] Optional callback. Called with no arguments on success, or with a single `Error` argument on failure.
 * @importFromPackage accounts-base
 */
Accounts.changePassword = (oldPassword, newPassword, callback) => {
  if (!Meteor.user()) {
    return reportError(new Error('Must be logged in to change password.'), callback);
  }

  if (typeof newPassword !== 'string') {
    return reportError(new Meteor.Error(400, 'Password must be a string'), callback);
  }

  if (!newPassword) {
    return reportError(new Meteor.Error(400, 'Password may not be empty'), callback);
  }

  // @ts-expect-error
  Accounts.connection.apply(
    'changePassword',
    [oldPassword ? Accounts._hashPassword(oldPassword) : null, Accounts._hashPassword(newPassword)],
    (error: any, result: any) => {
      if (error || !result) {
        // A normal error, not an error telling us to upgrade to bcrypt
        reportError(error || new Error('No result from changePassword.'), callback);
      } else {
        callback && callback();
      }
    }
  );
};
