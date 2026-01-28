import type {
  FieldSelector,
  HashPassword,
  LoginWithPhoneSelector,
  MethodCallback,
  MethodError,
} from './phone_password_types';

declare module 'meteor/meteor' {
  namespace Meteor {
    interface User {
      phone?: {
        number: string;
        verified: boolean;
      };
    }

    interface UserServices {
      phone?: {
        bcrypt?: string;
        verify?: {
          numOfRetries: number;
          code: string;
          phone: string;
          lastRetry: Date;
        };
      };
    }

    function loginWithPhoneAndPassword(
      user: LoginWithPhoneSelector,
      password: string,
      callback?: MethodCallback<void>
    ): void;
  }
}

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
    ): Promise<{ userId: string; error?: MethodError }>;

    function _handleError(message: string): never;

    function _getLoginToken(id: string): string;

    function _setLoginToken(
      id: string,
      connection: import('meteor/meteor').Meteor.Connection,
      oldToken: string | null
    ): string;

    function _loginMethod(
      methodInvocation: unknown,
      methodName: string,
      methodArgs: unknown[],
      type: string,
      fn: () => void
    ): Promise<unknown>;

    function _clearAllLoginTokens(userId: string): Promise<void>;

    function insertUserDoc(
      options: { phone: string; password?: string },
      user: import('meteor/meteor').Meteor.User
    ): Promise<string>;

    function requestPhoneVerification(phone: string, callback?: MethodCallback<void>): void;

    function verifyCode(phone: string, code: string, callback?: MethodCallback<void>): void;

    function verifyPhone(phone: string, code: string, callback?: MethodCallback<void>): void;
    function verifyPhone(
      phone: string,
      code: string,
      newPassword: string,
      callback?: MethodCallback<void>
    ): void;

    function isPhoneVerified(): boolean;

    function changePassword(oldPassword: string, newPassword: string, callback?: MethodCallback<void>): void;

    function sendSms(phone: string, code: string): Promise<void> | void;

    function sendPhoneVerificationCodeAsync(userId: string, phone?: string): Promise<void>;
  }
}
