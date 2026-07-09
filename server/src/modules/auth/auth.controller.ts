import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.register(req.body);

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.login(req.body);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.refresh(req.body.refreshToken);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.logout(req.body.refreshToken);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.forgotPassword(req.body.email);

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.resetPassword(
      req.body.token,
      req.body.password
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.changePassword(
    //   req.user.id,
    //   req.body.oldPassword,
    //   req.body.newPassword
        req.body.userId,
        req.body.oldPassword,
        req.body.newPassword
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await authService.verifyEmail(
      req.query.token as string
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export const authController = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail
};

