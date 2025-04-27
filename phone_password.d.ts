type MethodCallback = (
  error?:
    | import('meteor/meteor').global_Error
    | import('meteor/meteor').Meteor.Error
    | import('meteor/meteor').Meteor.TypedError,
  result?: any
) => void;

declare module 'meteor/meteor' {
  namespace Meteor {
    interface User {
      phone: {
        number: string;
        verified: boolean;
      };
      services?: {
        phone?: {
          bcrypt?: string;
          verify?: {
            numOfRetries: number;
            code: string;
            phone: string;
            lastRetry: Date;
          };
        };
      };
    }

    function loginWithPhoneAndPassword(
      user: { phone: string } | { id: string } | string,
      password: string,
      callback?: MethodCallback
    ): void;
  }
}

type FieldSelector = { fields?: import('meteor/mongo').Mongo.FieldSpecifier | undefined };

declare module 'meteor/accounts-base' {
  namespace Accounts {
    const _options: {
      bcryptRounds: number;
      verificationWaitTime: number;
      verificationMaxRetries: number;
      verificationRetriesWaitTime: number;
      verificationCodeLength: number;
      adminPhoneNumbers: string;
      phoneVerificationMasterCode: string;
    };

    let _checkPasswordUserFields: {
      _id: number;
      services: number;
    };

    function _addDefaultFieldSelector(options?: FieldSelector): FieldSelector;

    function _bcryptRounds(): number;

    function _checkPhonePasswordAsync(
      user: import('meteor/meteor').Meteor.User,
      password: string | HashPassword
    ): Promise<{ userId: string; error?: any }>;

    function _handleError(message: string): never;

    function _getLoginToken(id: string): string;

    function _setLoginToken(
      id: string,
      connection: import('meteor/meteor').Meteor.Connection,
      oldToken: string | null
    ): string;

    function _loginMethod(
      methodInvocation: any,
      methodName: string,
      methodArgs: any[],
      type: string,
      fn: () => void
    ): Promise<any>;

    function _clearAllLoginTokens(userId: string): Promise<void>;

    function insertUserDoc(
      options: { phone: string; password?: string },
      user: import('meteor/meteor').Meteor.User
    ): Promise<string>;

    function requestPhoneVerification(phone: string, callback?: MethodCallback): void;

    function verifyCode(phone: string, code: string, callback: MethodCallback): void;

    function verifyPhone(phone: string, code: string, newPassword: string, callback: MethodCallback): void;

    function isPhoneVerified(): boolean;

    function changePassword(oldPassword: string, newPassword: string, callback: MethodCallback): void;

    function sendSms(phone: string, code: string): Promise<void> | void;

    function sendPhoneVerificationCodeAsync(userId: string, phone?: string): Promise<void>;
  }
}

type HashPassword = { digest: string; algorithm: string };
