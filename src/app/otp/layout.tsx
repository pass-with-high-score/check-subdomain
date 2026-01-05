import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'OTP Generator - TOTP Code Generator',
    description: 'Generate Time-based One-Time Password (TOTP) codes from your secret keys. Support for saving keys, password protection, QR code export, and multiple authenticator formats.',
    keywords: [
        'OTP generator',
        'TOTP generator',
        'authenticator',
        'two-factor authentication',
        '2FA',
        'one-time password',
        'Google Authenticator',
        'secret key',
        'QR code',
    ],
    openGraph: {
        title: 'OTP Generator - TOTP Code Generator',
        description: 'Free online TOTP code generator with key saving, password protection, and QR code export.',
        type: 'website',
    },
};

export default function OTPLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
