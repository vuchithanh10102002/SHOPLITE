// import "express";
// import { Logger } from "pino";

// declare module "express-serve-static-core" {
//   interface UserPayload {
//     id: string;
//     role: string;
//   }

//   interface Request {
//     log: Logger;
//     user: UserPayload;
//   }
// }

import "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      role: string;
    }

    interface Request {
      user: UserPayload;
    }
  }
}

export {};