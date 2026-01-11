import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'JSON Server - Mock REST API Generator',
    description: 'Create instant mock REST APIs from JSON data. Perfect for frontend development, prototyping, and testing. Supports CRUD operations, pagination, filtering, and more.',
    keywords: [
        'JSON server',
        'mock API',
        'REST API',
        'API generator',
        'mock server',
        'fake API',
        'json placeholder',
        'API testing',
        'frontend mock',
    ],
    openGraph: {
        title: 'JSON Server - Mock REST API Generator',
        description: 'Create instant mock REST APIs from JSON. Perfect for frontend development and prototyping.',
        type: 'website',
    },
};

export default function JSONLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
