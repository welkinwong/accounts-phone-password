import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

Meteor.methods({
  findUserAsync: async phoneNumber => await Meteor.users.findOneAsync({ 'phone.number': phoneNumber }),
  removeUserAsync: async phoneNumber => await Meteor.users.removeAsync({ 'phone.number': phoneNumber }),
  setSms: () => (Accounts.sendSms = (phone, code) => {}),
});
