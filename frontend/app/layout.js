export const metadata = {
  title: "Store",
  description: "Minimal full-stack e-commerce store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
