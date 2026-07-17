import { describe, expect, test } from "bun:test";
import { isValidWorkerId } from "./workerLinkValidation";

describe("isValidWorkerId", () => {
  test("a positive integer is valid", () => {
    expect(isValidWorkerId(7)).toBe(true);
    expect(isValidWorkerId(1)).toBe(true);
  });

  test("zero is invalid", () => {
    expect(isValidWorkerId(0)).toBe(false);
  });

  test("a negative number is invalid", () => {
    expect(isValidWorkerId(-5)).toBe(false);
  });

  test("a non-integer number is invalid", () => {
    expect(isValidWorkerId(4.5)).toBe(false);
  });

  test("NaN is invalid", () => {
    expect(isValidWorkerId(NaN)).toBe(false);
  });

  test("Infinity is invalid", () => {
    expect(isValidWorkerId(Infinity)).toBe(false);
    expect(isValidWorkerId(-Infinity)).toBe(false);
  });

  test("null is invalid", () => {
    expect(isValidWorkerId(null)).toBe(false);
  });

  test("undefined is invalid", () => {
    expect(isValidWorkerId(undefined)).toBe(false);
  });

  test("a numeric string is invalid (no implicit coercion)", () => {
    expect(isValidWorkerId("7")).toBe(false);
  });

  test("an object/array is invalid", () => {
    expect(isValidWorkerId({})).toBe(false);
    expect(isValidWorkerId([7])).toBe(false);
  });
});
