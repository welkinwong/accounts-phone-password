import { Meteor } from 'meteor/meteor';
import { SHA256 } from 'meteor/sha';
import { hash as bcryptHash, compare as bcryptCompare } from 'bcrypt';
import { Accounts } from 'meteor/accounts-base';
import { Match, check } from 'meteor/check';
import { phone } from 'phone';
import type { FieldSelector, HashPassword } from './phone_password_types';

/**
 * send sms
 * need override method
 */
Accounts.sendSms =
  Accounts.sendSms ||
  (() => {
    throw new Error('please override this method');
  });

// Utility for grabbing user
const getUserById = async (id: string, options: FieldSelector) =>
  await Meteor.users.findOneAsync(id, Accounts._addDefaultFieldSelector(options));

// User records have a 'services.password.bcrypt' field on them to hold
// their hashed passwords.
//
// When the client sends a password to the server, it can either be a
// string (the plaintext password) or an object with keys 'digest' and
// 'algorithm' (must be "sha-256" for now). The Meteor client always sends
// password objects { digest: *, algorithm: "sha-256" }, but DDP clients
// that don't have access to SHA can just send plaintext passwords as
// strings.
//
// When the server receives a plaintext password as a string, it always
// hashes it with SHA256 before passing it into bcrypt. When the server
// receives a password as an object, it asserts that the algorithm is
// "sha-256" and then passes the digest to bcrypt.

Accounts._bcryptRounds = () => Accounts._options.bcryptRounds || 10;

// Given a 'password' from the client, extract the string that we should
// bcrypt. 'password' can be one of:
//  - String (the plaintext password)
//  - Object with 'digest' and 'algorithm' keys. 'algorithm' must be "sha-256".
//
const getPasswordString = (password: string | HashPassword) => {
  if (typeof password === 'string') {
    password = SHA256(password);
  } else {
    // 'password' is an object
    if (password.algorithm !== 'sha-256') {
      throw new Error('Invalid password hash algorithm. ' + "Only 'sha-256' is allowed.");
    }
    password = password.digest;
  }
  return password;
};

// Use bcrypt to hash the password for storage in the database.
// `password` can be a string (in which case it will be run through
// SHA256 before bcrypt) or an object with properties `digest` and
// `algorithm` (in which case we bcrypt `password.digest`).
//
const hashPassword = async (password: string | HashPassword) => {
  password = getPasswordString(password);
  return await bcryptHash(password, Accounts._bcryptRounds());
};

// Check whether the provided password matches the bcrypt'ed password in
// the database user record. `password` can be a string (in which case
// it will be run through SHA256 before bcrypt) or an object with
// properties `digest` and `algorithm` (in which case we bcrypt
// `password.digest`).
//
// The user parameter needs at least user._id and user.services
Accounts._checkPasswordUserFields = { _id: 1, services: 1 };

// Check whether the provided password matches the bcrypt'ed password in
// the database user record. `password` can be a string (in which case
// it will be run through SHA256 before bcrypt) or an object with
// properties `digest` and `algorithm` (in which case we bcrypt
// `password.digest`).
//
const checkPhonePasswordAsync = async (user: Meteor.User, password: string | HashPassword) => {
  var result: { userId: string; error?: any } = {
    userId: user._id,
  };

  const formattedPassword = getPasswordString(password);
  const hash = user.services!.phone!.bcrypt!;

  if (!(await bcryptCompare(formattedPassword, hash))) {
    result.error = new Meteor.Error(403, 'Incorrect password');
  }

  return result;
};

Accounts._checkPhonePasswordAsync = checkPhonePasswordAsync;

///
/// LOGIN
///

// Users can specify various keys to identify themselves with.
// @param user {Object} with `id` or `phone`.
// @returns A selector to pass to mongo to get the user record.

const selectorFromUserQuery = (user: { id?: string; phone?: string }) => {
  if (user.id) {
    return { _id: user.id };
  } else if (user.phone) {
    return { 'phone.number': user.phone };
  } else {
    throw new Error("shouldn't happen (validation missed something)");
  }
};

const findUserFromUserQuery = async (user: { id?: string; phone?: string }) => {
  const selector = selectorFromUserQuery(user);

  const actualUser = await Meteor.users.findOneAsync(selector);
  if (!actualUser) throw new Meteor.Error(403, 'User not found');

  return actualUser;
};

// XXX maybe this belongs in the check package
const NonEmptyString = Match.Where(x => {
  check(x, String);
  return x.length > 0;
});

const userQueryValidator = Match.Where(function (user) {
  check(user, {
    id: Match.Optional(NonEmptyString),
    phone: Match.Optional(NonEmptyString),
  });

  if (Object.keys(user).length !== 1) {
    // @ts-expect-error
    throw new Match.Error('User property must have exactly one field');
  }
  return true;
});

const passwordValidator = Match.OneOf(String, {
  digest: String,
  algorithm: String,
});

// Handler to login with a phone.
//
// The Meteor client sets options.password to an object with keys
// 'digest' (set to SHA256(password)) and 'algorithm' ("sha-256").
//
// For other DDP clients which don't have access to SHA, the handler
// also accepts the plaintext password in options.password as a string.
//
// (It might be nice if servers could turn the plaintext password
// option off. Or maybe it should be opt-in, not opt-out?
// Accounts.config option?)
//
// Note that neither password option is secure without SSL.
//
// @ts-expect-error
Accounts.registerLoginHandler('phone', async options => {
  if (!options.password) return undefined; // don't handle

  check(options, {
    user: userQueryValidator,
    password: passwordValidator,
  });

  const user = await findUserFromUserQuery(options.user);

  if (!user.services || !user.services.phone || !user.services.phone.bcrypt) {
    Accounts._handleError('User has no password set');
  }

  const result = await Accounts._checkPhonePasswordAsync(user, options.password);

  return result;
});

///
/// CHANGING
///

// Let the user change their own password if they know the old
// password. `oldPassword` and `newPassword` should be objects with keys
// `digest` and `algorithm` (representing the SHA256 of the password).
Meteor.methods({
  changePassword: async function (oldPassword: HashPassword, newPassword: HashPassword) {
    check(oldPassword, passwordValidator);
    check(newPassword, passwordValidator);

    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const user = await getUserById(this.userId, {
      fields: {
        // @ts-expect-error
        services: 1,
        ...Accounts._checkPasswordUserFields,
      },
    });
    if (!user) {
      Accounts._handleError('User not found');
    }

    if (!user.services || !user.services.phone || !user.services.phone.bcrypt) {
      Accounts._handleError('User has no password set');
    }

    const result = await checkPhonePasswordAsync(user, oldPassword);
    if (result.error) {
      throw result.error;
    }

    const hashed = await hashPassword(newPassword);

    // It would be better if this removed ALL existing tokens and replaced
    // the token for the current connection with a new one, but that would
    // be tricky, so we'll settle for just replacing all tokens other than
    // the one for the current connection.
    const currentToken = Accounts._getLoginToken(this.connection!.id);

    await Meteor.users.updateAsync(
      { _id: user._id },
      {
        $set: { 'services.phone.bcrypt': hashed },
        $pull: { 'services.resume.loginTokens': { hashedToken: { $ne: currentToken } } },
        $unset: { 'services.phone.verify': 1 },
      }
    );

    return { passwordChanged: true };
  },
});

///
/// Send phone VERIFICATION code
///

// send the user a sms with a code that can be used to verify number

/**
 * @summary Send an SMS with a code the user can use verify their phone number with.
 * @locus Server
 * @param userId The id of the user to send email to.
 * @param phone Optional. Which phone of the user's to send the SMS to. This phone must be in the user's `phones` list. Defaults to the first unverified phone in the list.
 */
Accounts.sendPhoneVerificationCodeAsync = async (userId: string, phone?: string) => {
  // XXX Also generate a link using which someone can delete this
  // account if they own said number but weren't those who created
  // this account.

  // Make sure the user exists, and phone is one of their phones.
  const user = await Meteor.users.findOneAsync(userId);
  if (!user) throw new Error("Can't find user");

  // pick the first unverified phone if we weren't passed an phone.
  if (!phone && user.phone) {
    phone = user.phone && user.phone.number;
  }

  // make sure we have a valid phone
  if (!phone) throw new Error('No such phone for user.');

  // If sent more than max retry wait
  const waitTimeBetweenRetries = Accounts._options.verificationWaitTime;
  const maxRetryCounts = Accounts._options.verificationMaxRetries;

  let verifyObject = { numOfRetries: 0 } as NonNullable<
    NonNullable<NonNullable<Meteor.User['services']>['phone']>['verify']
  >;
  if (user.services && user.services.phone && user.services.phone.verify) {
    verifyObject = user.services.phone.verify;
  }

  const curTime = new Date();

  // Check if last retry was too soon
  let nextRetryDate =
    verifyObject && verifyObject.lastRetry && new Date(verifyObject.lastRetry.getTime() + waitTimeBetweenRetries);

  if (nextRetryDate && nextRetryDate > curTime) {
    const waitTimeInSec = Math.ceil(
      Math.abs(((nextRetryDate as unknown as number) - (curTime as unknown as number)) / 1000)
    );
    const errMsg = 'Too often retries, try again in ' + waitTimeInSec + ' seconds.';
    throw new Error(errMsg);
  }

  // Check if there where too many retries
  if (verifyObject.numOfRetries > maxRetryCounts) {
    // Check if passed enough time since last retry
    const waitTimeBetweenMaxRetries = Accounts._options.verificationRetriesWaitTime;
    nextRetryDate = new Date(verifyObject.lastRetry.getTime() + waitTimeBetweenMaxRetries);
    if (nextRetryDate > curTime) {
      const waitTimeInMin = Math.ceil(
        Math.abs(((nextRetryDate as unknown as number) - (curTime as unknown as number)) / 60000)
      );
      const errMsg = 'Too many retries, try again in ' + waitTimeInMin + ' minutes.';
      throw new Error(errMsg);
    }
  }

  verifyObject.code = getRandomCode(Accounts._options.verificationCodeLength);
  verifyObject.phone = phone;
  verifyObject.lastRetry = curTime;
  verifyObject.numOfRetries++;

  await Meteor.users.updateAsync({ _id: userId }, { $set: { 'services.phone.verify': verifyObject } });

  await Accounts.sendSms(phone, verifyObject.code);
};

// Send SMS with code to user.
Meteor.methods({
  requestPhoneVerification: async function (phone) {
    if (phone) {
      check(phone, String);
      // Change phone format to international SMS format
      phone = normalizePhone(phone);
    }

    if (!phone) {
      throw new Meteor.Error(403, 'Not a valid phone');
    }

    let userId: any = this.userId;
    if (!userId) {
      // Get user by phone number
      let existingUser = await Meteor.users.findOneAsync({ 'phone.number': phone }, { fields: { _id: 1 } });
      if (existingUser) {
        userId = existingUser && existingUser._id;
      } else {
        // Create new user with phone number
        userId = await createUserAsync({ phone });
      }
    }

    try {
      await Accounts.sendPhoneVerificationCodeAsync(userId, phone);
    } catch (error: any) {
      throw new Meteor.Error(500, error.message);
    }
  },
});

Meteor.methods({
  verifyCode: async function (phone, code) {
    check(code, String);
    check(phone, String);

    if (!code) throw new Meteor.Error(403, 'Code is must be provided to method');

    // Change phone format to international SMS format
    phone = normalizePhone(phone);

    var user = await Meteor.users.findOneAsync({ 'phone.number': phone });
    if (!user) throw new Meteor.Error(403, 'Not a valid phone');

    // Verify code is accepted or master code
    if (!user.services!.phone?.verify?.code || (user.services!.phone.verify.code != code && !isMasterCode(code))) {
      throw new Meteor.Error(403, 'Not a valid code');
    }
  },
});

// Take code from sendVerificationPhone SMS, mark the phone as verified,
// Change password if needed
// and log them in.
Meteor.methods({
  verifyPhone: async function (phone, code, newPassword) {
    var self = this;
    // Check if needs to change password

    return await Accounts._loginMethod(this, 'verifyPhone', [phone, code, newPassword], 'phone', async () => {
      check(code, String);
      check(phone, String);

      if (!code) throw new Meteor.Error(403, 'Code is must be provided to method');

      // Change phone format to international SMS format
      phone = normalizePhone(phone);

      const user = await Meteor.users.findOneAsync({ 'phone.number': phone });
      if (!user) throw new Meteor.Error(403, 'Not a valid phone');

      // Verify code is accepted or master code
      if (!user.services!.phone?.verify?.code || (user.services!.phone.verify.code != code && !isMasterCode(code))) {
        throw new Meteor.Error(403, 'Not a valid code');
      }

      let setOptions: { 'phone.verified': boolean; 'services.phone.bcrypt'?: string } = {
          'phone.verified': true,
        },
        unSetOptions = { 'services.phone.verify': 1 };

      // If needs to update password
      if (newPassword) {
        check(newPassword, passwordValidator);
        const hashed = await hashPassword(newPassword);

        // NOTE: We're about to invalidate tokens on the user, who we might be
        // logged in as. Make sure to avoid logging ourselves out if this
        // happens. But also make sure not to leave the connection in a state
        // of having a bad token set if things fail.
        const oldToken = Accounts._getLoginToken(self.connection!.id);

        Accounts._setLoginToken(user._id, self.connection!, null);
        var resetToOldToken = function () {
          Accounts._setLoginToken(user._id, self.connection!, oldToken);
        };

        setOptions['services.phone.bcrypt'] = hashed;
      }

      try {
        let query = {
          _id: user._id,
          'phone.number': phone,
          'services.phone.verify.code': code,
        };

        // Allow master code from settings
        if (isMasterCode(code)) {
          // @ts-expect-error
          delete query['services.phone.verify.code'];
        }

        // Update the user record by:
        // - Changing the password to the new one
        // - Forgetting about the verification code that was just used
        // - Verifying the phone, since they got the code via sms to phone.
        var affectedRecords = await Meteor.users.updateAsync(query, {
          $set: setOptions,
          $unset: unSetOptions,
        });
        if (affectedRecords !== 1) {
          return { userId: user._id, error: new Meteor.Error(403, 'Invalid phone') };
        }
      } catch (err) {
        // @ts-expect-error
        resetToOldToken();
        throw err;
      }

      // Replace all valid login tokens with new ones (changing
      // password should invalidate existing sessions).
      await Accounts._clearAllLoginTokens(user._id);

      return { userId: user._id };
    });
  },
});

///
/// CREATING USERS
///

// Shared createUser function called from the createUser method, both
// if originates in client or server code. Calls user provided hooks,
// does the actual user insertion.
//
// returns the user id
const createUserAsync = async (options: { phone: string; password?: string }): Promise<string> => {
  // Unknown keys allowed, because a onCreateUserHook can take arbitrary
  // options.
  check(
    options,
    Match.ObjectIncluding({
      phone: Match.Optional(String),
      password: Match.Optional(passwordValidator),
    })
  );

  const { phone, password } = options;
  if (!phone) throw new Meteor.Error(400, 'Need to set phone');

  const existingUser = await Meteor.users.findOneAsync({
    'phone.number': phone,
  });
  if (existingUser) {
    throw new Meteor.Error(403, 'User with this phone number already exists');
  }

  const user = { services: {} } as Meteor.User;
  if (password) {
    const hashed = await hashPassword(password);
    user.services!.phone = { bcrypt: hashed };
  }

  user.phone = { number: phone, verified: false };

  try {
    return Accounts.insertUserDoc(options, user);
  } catch (error) {
    // XXX string parsing sucks, maybe
    // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day
    // @ts-expect-error
    if (error.name !== 'MongoError') throw error;

    // @ts-expect-error
    const match = error.err.match(/E11000 duplicate key error index: ([^ ]+)/);
    if (!match) throw error;

    if (match[1].indexOf('users.$phone.number') !== -1)
      throw new Meteor.Error(403, 'Phone number already exists, failed on creation.');

    throw error;
  }
};

///
/// PASSWORD-SPECIFIC INDEXES ON USERS
///
// @ts-expect-error
await Meteor.users.createIndexAsync('phone.number', {
  unique: true,
  sparse: true,
});

/*** Control published data *********/
Meteor.startup(function () {
  /** Publish phones to the client **/
  Meteor.publish(null, function () {
    if (this.userId) {
      return Meteor.users.find({ _id: this.userId }, { fields: { phone: 1 } });
    } else {
      this.ready();
    }
  });

  /** Disable user profile editing **/
  Meteor.users.deny({
    update: function () {
      return true;
    },
  });
});

/************* Helper functions ********************/

// Return normalized phone format
const normalizePhone = (phoneNumber: string) => {
  // If phone equals to one of admin phone numbers return it as-is
  if (
    phoneNumber &&
    Accounts._options.adminPhoneNumbers &&
    Accounts._options.adminPhoneNumbers.indexOf(phoneNumber) != -1
  ) {
    return phoneNumber;
  }
  return phone(phoneNumber).phoneNumber;
};

/**
 * Check whether the given code is the defined master code
 * @param code
 * @returns {*|boolean}
 */
const isMasterCode = (code: string): any | boolean => {
  return code && Accounts._options.phoneVerificationMasterCode && code == Accounts._options.phoneVerificationMasterCode;
};

/**
 * Get random phone verification code
 */
const getRandomCode = (length: number): string => {
  length = length || 4;
  let output = '';
  while (length-- > 0) {
    // random 1-9 digit
    output += Math.floor(Math.random() * 9 + 1);
  }
  return output;
};
