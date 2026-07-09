import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma";
import {
  generateAccessToken,
  generateEmailToken,
  generateRefreshToken,
  sha256,
  verifyRefreshToken,
} from "./token.service";
import { LoginInput, RegisterInput } from "./auth.schemas";
import { emailQueue } from "../../lib/queue";
import { addDays, addHours } from "date-fns";
import { randomUUID } from "node:crypto";


async function register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
        where: {
            email: data.email,
        },
    });

    if (existingUser) {
        throw new Error("Email đã tồn tại");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
        data: {
            email: data.email,
            fullName: data.fullName,
            passwordHash,
        },
    });

    const verifyToken = generateEmailToken({
        sub: user.id,
        type: "VERIFY",
    });

    const tokenHash = sha256(verifyToken);

    await prisma.emailToken.create({
        data: {
        userId: user.id,
        tokenHash,
        type: "VERIFY",
        expiresAt: addHours(new Date(), 24),
        },
    });

    await emailQueue.add("verify-email", {
        email: user.email,
        fullName: user.fullName,
        token: verifyToken,
    });

    return {
        message:
        "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
    };
}

async function login(data: LoginInput) {
    const user = await prisma.user.findUnique({
        where: {
            email: data.email,
        },
    });

    if (!user) {
        throw new Error("Email hoặc mật khẩu không đúng");
    }

    if (!user.emailVerified) {
        throw new Error("Email chưa được xác thực");
    }

    const matched = await bcrypt.compare(
        data.password,
        user.passwordHash
    );

    if (!matched) {
        throw new Error("Email hoặc mật khẩu không đúng");
    }

    const accessToken = generateAccessToken({
        sub: user.id,
        role: user.role,
    });

    const refreshToken = generateRefreshToken({
        sub: user.id,
    });

    const familyId = randomUUID();

    const tokenHash = sha256(refreshToken);

    await prisma.refreshToken.create({
        data: {
            userId: user.id,
            familyId,
            tokenHash,
            expiresAt: addDays(new Date(), 7),
        },
    });

    return {
        accessToken,
        refreshToken,
        // user: {
        //     id: user.id,
        //     email: user.email,
        //     fullName: user.fullName,
        //     role: user.role,
        // },
    };
}

export async function refresh(refreshToken: string) {
    // Verify JWT
    const payload = verifyRefreshToken(refreshToken) as {
        sub: string;
    };

    // Hash JWT để tìm trong DB
    const tokenHash = sha256(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
        where: {
        tokenHash,
        },
    });

    if (!storedToken) {
        throw new Error("Refresh token không hợp lệ");
    }

    // Reuse Detection
    if (storedToken.revoked) {
        await prisma.refreshToken.updateMany({
            where: {
                familyId: storedToken.familyId,
            },
            data: {
                revoked: true,
            },
        });

        throw new Error("Refresh token đã bị thu hồi");
    }

    // Hết hạn
    if (storedToken.expiresAt < new Date()) {
        throw new Error("Refresh token đã hết hạn");
    }

    // Lấy user
    const user = await prisma.user.findUnique({
        where: {
            id: storedToken.userId,
        },
    });

    if (!user) {
        throw new Error("User không tồn tại");
    }

    // Sinh Access Token mới
    const accessToken = generateAccessToken({
        sub: user.id,
        role: user.role,
    });

    // Sinh Refresh Token mới
    const newRefreshToken = generateRefreshToken({
        sub: user.id,
    });

    const newTokenHash = sha256(newRefreshToken);

    await prisma.$transaction([
        prisma.refreshToken.update({
            where: {
                id: storedToken.id,
            },
            data: {
                revoked: true,
            },
        }),

        prisma.refreshToken.create({
            data: {
                userId: user.id,
                familyId: storedToken.familyId,
                tokenHash: newTokenHash,
                expiresAt: addDays(new Date(), 7),
            },
        }),
    ]);

    return {
        accessToken,
        refreshToken: newRefreshToken,
    };
}

async function logout(refreshToken: string) {
    verifyRefreshToken(refreshToken);

    const tokenHash = sha256(refreshToken);

    await prisma.refreshToken.update({
        where: {
            tokenHash,
        },
        data: {
            revoked: true,
        },
    });

    return {
        message: "Đăng xuất thành công",
    };
}

async function forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
        where: {
            email,
        },
    });

    if (!user) {
        return {
            message:
            "Nếu email tồn tại trong hệ thống, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.",
        };
    }

    const token = generateRefreshToken({
        sub: user.id,
        type: "RESET",
    });

    const tokenHash = sha256(token);

    await prisma.emailToken.create({
        data: {
            userId: user.id,
            tokenHash,
            type: "RESET",
            expiresAt: addHours(new Date(), 1),
        },
    });

    await emailQueue.add("forgot-password", {
        email: user.email,
        fullName: user.fullName,
        token,
    });

    return {
        message: "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.",
    };
}

async function resetPassword(
  token: string,
  password: string
) {
    const payload = verifyRefreshToken(token) as {
        sub: string;
    };

    const tokenHash = sha256(token);

    const emailToken = await prisma.emailToken.findUnique({
        where: {
            tokenHash,
        },
    });

    if (!emailToken) {
        throw new Error("Token không hợp lệ");
    }

    if (emailToken.type !== "RESET") {
        throw new Error("Token không hợp lệ");
    }

    if (emailToken.expiresAt < new Date()) {
        throw new Error("Token đã hết hạn");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
        prisma.user.update({
            where: {
            id: payload.sub,
            },
            data: {
            passwordHash,
            },
        }),

        prisma.emailToken.delete({
            where: {
            id: emailToken.id,
            },
        }),

        prisma.refreshToken.updateMany({
            where: {
            userId: payload.sub,
            },
            data: {
            revoked: true,
            },
        }),
    ]);

    return {
        message: "Đổi mật khẩu thành công",
    };
}

async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
) {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        throw new Error("User không tồn tại");
    }

    const matched = await bcrypt.compare(
        oldPassword,
        user.passwordHash
    );

    if (!matched) {
        throw new Error("Mật khẩu hiện tại không đúng");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
        prisma.user.update({
            where:{
                id:userId
            },
            data:{
                passwordHash
            }
        }),

        prisma.refreshToken.updateMany({
            where:{
                userId
            },
            data:{
                revoked:true
            }
        })
    ]);

    return {
        message: "Đổi mật khẩu thành công",
    };
}

async function verifyEmail(token: string) {
  const payload = verifyRefreshToken(token) as {
    sub: string;
  };

  const tokenHash = sha256(token);

  const emailToken = await prisma.emailToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!emailToken) {
    throw new Error("Token không hợp lệ");
  }

  if (emailToken.type !== "VERIFY") {
    throw new Error("Token không hợp lệ");
  }

  if (emailToken.expiresAt < new Date()) {
    throw new Error("Token đã hết hạn");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: payload.sub,
      },
      data: {
        emailVerified: true,
      },
    }),

    prisma.emailToken.delete({
      where: {
        id: emailToken.id,
      },
    }),
  ]);

  return {
    message: "Xác thực email thành công",
  };
}


export const authService = {
    register,
    login,
    refresh,
    changePassword,
    resetPassword,
    forgotPassword,
    logout,
    verifyEmail
};