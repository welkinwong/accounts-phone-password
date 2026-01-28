export type MethodError =
  | import('meteor/meteor').global_Error
  | import('meteor/meteor').Meteor.Error
  | import('meteor/meteor').Meteor.TypedError;

export type MethodCallback<T = void> = (error?: MethodError, result?: T) => void;

export type LoginWithPhoneSelector = { phone: string } | { id: string } | string;

export type FieldSelector = { fields?: import('meteor/mongo').Mongo.FieldSpecifier | undefined };

export type HashPassword = { digest: string; algorithm: string };
