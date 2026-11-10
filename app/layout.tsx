import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'veriimg — Instant Client-Side Image Verification',
  description:
    'Consumer-focused spatial image watermarking and instant verification web application with an iOS-inspired minimalist interface, client-side Web Worker engine, and R&D calibration lab.',
  openGraph: {
    title: 'veriimg — Instant Client-Side Image Verification',
    description:
      'Consumer-focused spatial image watermarking and instant verification web application with an iOS-inspired minimalist interface, client-side Web Worker engine, and R&D calibration lab.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'veriimg — Instant Client-Side Image Verification',
    description:
      'Consumer-focused spatial image watermarking and instant verification web application with an iOS-inspired minimalist interface, client-side Web Worker engine, and R&D calibration lab.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[#F5F5F7] text-zinc-900 dark:bg-[#09090B] dark:text-zinc-100 font-sans selection:bg-[#007AFF]/20 selection:text-[#007AFF] transition-colors duration-200"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
