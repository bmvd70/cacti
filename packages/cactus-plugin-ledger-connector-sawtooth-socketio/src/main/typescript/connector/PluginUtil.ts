/*
 * Copyright 2021 Hyperledger Cactus Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * PluginUtil.js
 */

const cbor = require("cbor");

/*
 * Summary:
 * Cooperation server: utility library dependent on endchains
 * For example, implementing internal functions that should not be exposed as functions of server plugins.
 */

/*
 * convNum
 *
 * @param {String/Number} value: The scientific string or numeric value to be converted. For numbers, it is returned as is.
 * @param {String/Number} defaultValue: The value to use if conversion was not possible. Text or number in scientific notation. Optional.
 *
 * @return {Number} The value converted to a number, or the defaultValue if the conversion failed.
 *
 * @desc exponentiation is also supported. The following formats are supported:. (value, defaultValue)
 *         3.78*10^14
 *         3.78e14
 */
exports.convNum = function convNum(value: number | string, defaultValue: number | string) {
  let retValue = 0;
  let defValue = 0;

  switch (typeof defaultValue) {
    case "number":
      defValue = defaultValue;
      break;
    case "string":
      const defValueStr = defaultValue.replace(/\*10\^/g, "e");
      defValue = parseFloat(defValueStr);
      break;
    default:
      // undefined should also be included here.
      // Fixed value because of cumbersome handling.
      defValue = 0;
      break;
  } // switch(typeof(defaultValue))

  if (Number.isNaN(defValue)) {
    // number is guaranteed.
    defValue = 0;
  }

  switch (typeof value) {
    case "number":
      retValue = value;
      break;
    case "string":
      const valueStr = value.replace(/\*10\^/g, "e");
      retValue = parseFloat(valueStr);
      break;
    default:
      // Set default value.
      retValue = defValue;
      break;
  } // switch(typeof(value))

  if (Number.isNaN(retValue)) {
    // number is guaranteed.
    retValue = defValue;
  }

  return retValue;
};

exports.convertBlockNumber = function (value: number) {
  return "0x" + ("0000000000000000" + value.toString(16)).substr(-16);
};

exports.decodeBase64 = function (encoded: string): Buffer {
  return Buffer.from(encoded, "base64");
};

exports.deccodeCbor = function (encoded: any): Array<any> {
  return cbor.decodeAllSync(encoded);
};
