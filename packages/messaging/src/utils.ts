import { serializeError } from 'serialize-error';

// export function verifyMessageDetail<T extends { response: any } = { response: any }>(
//   detail: T,
//   options: { targetScope?: object } = { targetScope: window },
// ) {
//   let _detail = detail;

//   try {
//     _detail =
//       // @ts-expect-error not exist cloneInto types because implemented only in Firefox.
//       typeof cloneInto !== 'undefined'
//         ? // @ts-expect-error cloneInto
//           cloneInto(_detail, options.targetScope)
//         : structuredClone(_detail);
//   } catch (err) {
//     _detail.response = { err: serializeError(err) };
//   }

//   return _detail;
// }

export function verifyMessageDetail<T>(
  detail: T,
  options: { targetScope?: object } = { targetScope: window ?? undefined },
): T {
  // @ts-expect-error not exist cloneInto types because implemented only in Firefox.
  return typeof cloneInto !== 'undefined'
    ? // @ts-expect-error cloneInto
      cloneInto(detail, options.targetScope)
    : structuredClone(detail);
}
