import QRCode from "react-qr-code";

export default function QRCodeDisplay({ roomName }) {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/room/${roomName}?mobile=true`;
  return (
    <div className="mt-6">
      <QRCode value={url} size={256} />
      <p className="mt-2">Scan to join with your phone</p>
    </div>
  );
}
