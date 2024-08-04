import { Meteor } from 'meteor/meteor';
// @ts-expect-error
import { Tinytest } from 'meteor/tinytest';
import { Accounts } from 'meteor/accounts-base';

const PHONE_NUMBER = '+8618000000000';

if (Meteor.isClient)
  (() => {
    Meteor.call('setSms');

    Tinytest.add('accounts-phone-password - requestPhoneVerification - notPhoneNumber', test => {
      test.throws(() => {
        Accounts.requestPhoneVerification();
      });
    });

    Tinytest.addAsync('accounts-phone-password - requestPhoneVerification - sendSms', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async error => {
        if (error) {
          test.fail(error);
        }

        await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);

        onComplete();
      });
    });

    Tinytest.add('accounts-phone-password - verifyPhone - notPhone', (test, onComplete) => {
      test.throws(() => {
        Accounts.verifyPhone();
      });
    });

    Tinytest.add('accounts-phone-password - verifyPhone - notCode', (test, onComplete) => {
      test.throws(() => {
        Accounts.verifyPhone(PHONE_NUMBER);
      });
    });

    Tinytest.addAsync('accounts-phone-password - verifyPhone - errCode', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, () => {
        Accounts.verifyPhone(PHONE_NUMBER, '1', undefined, async error => {
          if (error) {
            test.expect_fail();
            test.fail(error);
          } else {
            test.fail();
          }

          await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
          onComplete();
        });
      });
    });

    Tinytest.addAsync('accounts-phone-password - verifyPhone - verifyCode', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, undefined, async error => {
          if (error) {
            test.fail(error);
          } else {
            const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

            test.isTrue(user.phone.verified);

            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
          }

          onComplete();
        });
      });
    });

    Tinytest.addAsync('accounts-phone-password - verifyPhone - verifyAndSetPassword', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '123456', async error => {
          if (error) {
            test.fail(error);
          } else {
            const newUser = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

            test.isTrue(newUser.services.phone.bcrypt);

            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
          }

          onComplete();
        });
      });
    });

    Tinytest.addAsync('accounts-phone-password - verifyPhone - verifyAndChangePassword', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '111111', async error => {
          if (error) {
            test.fail(error);
            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
            return;
          }

          Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
            const firstUser = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

            Accounts.verifyPhone(PHONE_NUMBER, firstUser.services.phone.verify.code, '123456', async error => {
              if (error) {
                test.fail(error);
                await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
                onComplete();
                return;
              }

              const secoundUser = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

              test.notEqual(firstUser.services.phone.bcrypt, secoundUser.services.phone.bcrypt);

              await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
              onComplete();
            });
          });
        });
      });
    });

    Tinytest.add('accounts-phone-password - changePassword - notOldPassword', test => {
      test.throws(() => {
        Accounts.changePassword();
      });
    });

    Tinytest.add('accounts-phone-password - changePassword - notNewPasswordOrCallback', test => {
      test.throws(() => {
        Accounts.changePassword('111111');
      });
    });

    Tinytest.add('accounts-phone-password - changePassword - notSignIn', test => {
      test.throws(() => {
        Accounts.changePassword('111111', '123456');
      });
    });

    Tinytest.addAsync('accounts-phone-password - changePassword - incorrectPassword', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '111111', async error => {
          if (error) {
            test.fail(error);
            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
            return;
          }

          Accounts.changePassword('222222', '123456', async error => {
            if (error) {
              test.expect_fail();
              test.fail(error);
            } else {
              test.fail();
            }

            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
          });
        });
      });
    });

    Tinytest.addAsync('accounts-phone-password - changePassword - changePassword', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '111111', async error => {
          if (error) {
            test.fail(error);
            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
            return;
          }

          const firstUser = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

          Accounts.changePassword('111111', '123456', async error => {
            if (error) {
              test.fail(error);
              await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
              onComplete();
              return;
            }

            const secoundUser = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

            test.notEqual(firstUser.services.phone.bcrypt, secoundUser.services.phone.bcrypt);

            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
          });
        });
      });
    });

    Tinytest.add('accounts-phone-password - isPhoneVerified - notSignIn', test => {
      test.isFalse(Accounts.isPhoneVerified());
    });

    Tinytest.addAsync('accounts-phone-password - isPhoneVerified - notVerified', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, () => {
        test.isFalse(Accounts.isPhoneVerified());
        onComplete();
      });
    });

    Tinytest.addAsync('accounts-phone-password - isPhoneVerified - verified', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '111111', async error => {
          if (error) {
            test.fail(error);
            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
            return;
          }

          test.isTrue(Accounts.isPhoneVerified());

          await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
          onComplete();
        });
      });
    });

    Tinytest.add('accounts-phone-password - loginWithPhoneAndPassword - notSelector', test => {
      test.throws(() => {
        Meteor.loginWithPhoneAndPassword();
      });
    });

    Tinytest.add('accounts-phone-password - loginWithPhoneAndPassword - notPassword', test => {
      test.throws(() => {
        Meteor.loginWithPhoneAndPassword(PHONE_NUMBER);
      });
    });

    Tinytest.addAsync('accounts-phone-password - loginWithPhoneAndPassword - notUser', (test, onComplete) => {
      Meteor.loginWithPhoneAndPassword(PHONE_NUMBER, '111111', error => {
        if (error) {
          test.expect_fail();
          test.fail(error);
        } else {
          test.fail();
        }

        onComplete();
      });
    });

    Tinytest.addAsync('accounts-phone-password - loginWithPhoneAndPassword - incorrectPassword', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '111111', async error => {
          if (error) {
            test.fail(error);
            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
            return;
          }

          Meteor.loginWithPhoneAndPassword(PHONE_NUMBER, '123456', async error => {
            if (error) {
              test.expect_fail();
              test.fail(error);
            } else {
              test.fail();
            }

            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
          });
        });
      });
    });

    Tinytest.addAsync('accounts-phone-password - loginWithPhoneAndPassword - signIn', (test, onComplete) => {
      Accounts.requestPhoneVerification(PHONE_NUMBER, async () => {
        const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

        Accounts.verifyPhone(PHONE_NUMBER, user.services.phone.verify.code, '111111', async error => {
          if (error) {
            test.fail(error);
            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
            return;
          }

          Meteor.loginWithPhoneAndPassword(PHONE_NUMBER, '111111', async error => {
            if (error) {
              test.fail(error);
              await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
              onComplete();
              return;
            }

            const user = await Meteor.callAsync('findUserAsync', PHONE_NUMBER);

            test.isTrue(user.services.resume.loginTokens[0].hashedToken);

            await Meteor.callAsync('removeUserAsync', PHONE_NUMBER);
            onComplete();
          });
        });
      });
    });
  })();
