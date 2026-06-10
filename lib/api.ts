import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthRequiredError, ForbiddenError } from "@/lib/auth-errors";

export class ClientInputError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "ClientInputError";
    this.status = status;
  }
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("Validation failed.", 422, error.flatten());
  }

  if (error instanceof ClientInputError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof AuthRequiredError || error instanceof ForbiddenError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof Error) {
    console.error(error);
    return jsonError("Unexpected server error.", 500);
  }

  return jsonError("Unexpected server error.", 500);
}
