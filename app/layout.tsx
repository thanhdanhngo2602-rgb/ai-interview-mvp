import "./globals.css";

export const metadata = {
  title: "AI Interview MVP V1",
  description: "Standalone AI Interview MVP for Vietnamese voice interviews",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
