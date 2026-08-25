
export enum UdsNrc {
  SERVICE_NOT_SUPPORTED = 0x11,
  SUBFUNCTION_NOT_SUPPORTED = 0x12,
  INCORRECT_MESSAGE_LENGTH = 0x13,
  RESPONSE_TOO_LONG = 0x14,
  BUSY_REPEAT_REQUEST = 0x21,
  CONDITIONS_NOT_CORRECT = 0x22,
  REQUEST_SEQUENCE_ERROR = 0x24,
  REQUEST_OUT_OF_RANGE = 0x31,
  SECURITY_ACCESS_DENIED = 0x33,
  INVALID_KEY = 0x35,
  EXCEEDED_NUMBER_OF_ATTEMPTS = 0x36,
  REQUIRED_TIME_DELAY_NOT_EXPIRED = 0x37,
  UPLOAD_DOWNLOAD_NOT_ACCEPTED = 0x70,
  TRANSFER_DATA_SUSPENDED = 0x71,
  GENERAL_PROGRAMMING_FAILURE = 0x72,
  WRONG_BLOCK_SEQUENCE_COUNTER = 0x73,
  RESPONSE_PENDING = 0x78,
  SUBFUNCTION_NOT_SUPPORTED_IN_ACTIVE_SESSION = 0x7E,
  SERVICE_NOT_SUPPORTED_IN_ACTIVE_SESSION = 0x7F,
}

export const NRC_MESSAGES: Record<number, string> = {
  [UdsNrc.SERVICE_NOT_SUPPORTED]: "Service Not Supported",
  [UdsNrc.SUBFUNCTION_NOT_SUPPORTED]: "Sub-function Not Supported",
  [UdsNrc.INCORRECT_MESSAGE_LENGTH]: "Incorrect Message Length",
  [UdsNrc.RESPONSE_TOO_LONG]: "Response Too Long",
  [UdsNrc.BUSY_REPEAT_REQUEST]: "ECU Busy - Repeat Request",
  [UdsNrc.CONDITIONS_NOT_CORRECT]: "Safety Conditions Not Correct (Engine Running?)",
  [UdsNrc.REQUEST_SEQUENCE_ERROR]: "Request Sequence Error",
  [UdsNrc.REQUEST_OUT_OF_RANGE]: "Request Out Of Range",
  [UdsNrc.SECURITY_ACCESS_DENIED]: "Security Access Denied (UDS 0x27 Required)",
  [UdsNrc.INVALID_KEY]: "Invalid Security Key",
  [UdsNrc.EXCEEDED_NUMBER_OF_ATTEMPTS]: "Exceeded Number of Attempts",
  [UdsNrc.REQUIRED_TIME_DELAY_NOT_EXPIRED]: "Security Time Delay Not Expired",
  [UdsNrc.UPLOAD_DOWNLOAD_NOT_ACCEPTED]: "Upload/Download Rejected",
  [UdsNrc.TRANSFER_DATA_SUSPENDED]: "Transfer Data Suspended",
  [UdsNrc.GENERAL_PROGRAMMING_FAILURE]: "General Programming Failure",
  [UdsNrc.WRONG_BLOCK_SEQUENCE_COUNTER]: "Wrong Block Sequence Counter",
  [UdsNrc.RESPONSE_PENDING]: "Response Pending (78)",
  [UdsNrc.SUBFUNCTION_NOT_SUPPORTED_IN_ACTIVE_SESSION]: "Sub-function Not Supported in Current Session",
  [UdsNrc.SERVICE_NOT_SUPPORTED_IN_ACTIVE_SESSION]: "Service Not Supported in Current Session",
};

export function parseUdsResponse(hex: string): { success: boolean; data?: string; nrc?: number; nrcText?: string } {
  const clean = hex.replace(/[\s\r\n>]/g, '').toUpperCase();
  
  if (clean.startsWith('7F')) {
    const serviceId = parseInt(clean.substring(2, 4), 16);
    const nrc = parseInt(clean.substring(4, 6), 16);
    return {
      success: false,
      nrc,
      nrcText: NRC_MESSAGES[nrc] || `Unknown NRC: 0x${nrc.toString(16)}`
    };
  }

  // Detection of positive responses (Service ID + 0x40)
  // This is a simplified check
  return { success: true, data: clean };
}
