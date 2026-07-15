import pino from "pino";

const logger = pino({
  // Test chay hang chuc request → log lam ngop output, che mat ket qua that su can doc.
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
});

export default logger;
