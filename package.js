Package.describe({
  name: 'welkinwong:accounts-phone-password',
  version: '1.0.0',
  summary: 'A login service based on mobile phone number for Meteor 3.0',
  git: 'https://github.com/welkinwong/accounts-phone-password.git',
  documentation: 'README.md',
});

Npm.depends({
  bcrypt: '5.1.1',
  phone: '3.1.49',
});

Package.onUse(api => {
  api.versionsFrom(['3.0']);
  api.use('ecmascript');
  api.use('typescript');
  api.use('zodern:types');
  api.use('check');
  api.use('accounts-base', ['client', 'server']);
  // Export Accounts (etc) to packages using this one.
  api.imply('accounts-base', ['client', 'server']);
  api.use('sha', ['client', 'server']);
  api.addFiles('phone_password_server.ts', 'server');
  api.addFiles('phone_password_client.ts', 'client');
});

Package.onTest(api => {
  api.use('tinytest');
  api.use('ecmascript');
  api.use('typescript');
  api.use('accounts-base');
  api.use('welkinwong:accounts-phone-password');
  api.addFiles('phone_password_tests_setup.ts', 'server');
  api.mainModule('phone_password_tests.ts');
});
