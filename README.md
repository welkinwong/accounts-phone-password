# accounts-phone-password

Accounts-Phone-Password is a Meteor package that let you authenticate by phone number. The package use SMS code verification to verify the user account. The package is based and inspired by [okland:accounts-phone](https://github.com/okland/accounts-phone) and [Meteor Accounts-Password package](https://github.com/meteor/meteor/tree/devel/packages/accounts-password).

this package only support Meteor 3.0

## Install

In a Meteor app directory, enter:

```sh
$ meteor add welkinwong:accounts-phone-password
```

## SMS Integration

you need set a SMS provider on server:

```ts
Accounts.sendSms = (phone: string, code: string) => {
  // SMS provider
};
```

**Note: it can only be done on server**

examples by aliyun SMS

```ts
import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as OpenApi from '@alicloud/openapi-client';
import * as Util from '@alicloud/tea-util';

const config = new OpenApi.Config(/** Config **/);
config.endpoint = `dysmsapi.aliyuncs.com`;

const aliClient = new Dysmsapi20170525(config);

const templateCode = '/** templateCode **/';

Accounts.sendSms = (phone: string, code: string) => {
  aliClient
    .sendSmsWithOptions(
      new SendSmsRequest({
        phoneNumbers: phone,
        signName: '/** signName **/',
        templateCode,
        templateParam: `{code:${code}}`,
      }),
      new Util.RuntimeOptions({})
    )
    .catch(error => console.warn(error));
};
```

## Usage

```ts
import { Accounts } from 'meteor/accounts-base';
```

### requestPhoneVerification

Request a new verification code. create user if not exist

```ts
Accounts.requestPhoneVerification(phone: string, callback: (error: Meteor.Error) => void)
```

### verifyCode

Check if the code is correct

```ts
Accounts.verifyCode(phone: string, code: string, callback?: (error: Meteor.Error) => void)
```

### verifyPhone

Marks the user's phone as verified. Optional change passwords, Logs the user in afterwards

```ts
Accounts.verifyPhone(phone: string, code: string, newPassword?: string, callback?: (error: Meteor.Error) => void)
```

### isPhoneVerified

Returns whether the current user phone is verified

```ts
Accounts.isPhoneVerified(): boolean
```

### changePassword

Change the current user's password. Must be logged in.

```ts
Accounts.changePassword(oldPassword: string, newPassword: string, callback: (error: Meteor.Error) => void)
```

### loginWithPhoneAndPassword

Log the user in with a password.

```ts
Meteor.loginWithPhoneAndPassword(selector: string | { phone: string } | { id: string }, password: string, callback: (error: Meteor.Error) => void)
```

## Development

### Setup

1. Clone the repository

```sh
git clone https://github.com/welkinwong/accounts-phone-password.git
```

```
cd accounts-phone-password
```

2. Install Dependencies

```sh
npm install && meteor
```

### Testing

This repo contains tests to help reduce bugs and breakage. Before committing and submitting your changes, you should run the tests and make sure they pass. Follow these steps to run the tests for this repo.

1. From the project directory, move into the testApp directory

```
link accounts-phone-password to project/packages
```

2. Add local package

```sh
meteor add welkinwong:accounts-phone-password
```

2. Run Tests

```
meteor test-packages
```
