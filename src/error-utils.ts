export const formatError = (error: unknown): unknown => {
  const responseData = (error as { response?: { data?: unknown } })?.response?.data;
  if (responseData !== undefined) {
    return responseData;
  }

  const message = (error as { message?: string })?.message;
  if (message) {
    return message;
  }

  return error;
}