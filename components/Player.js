import YouTube from 'react-youtube';

export default function Player({ roomId }) {
  // TODO: Listen to Firebase queue
  const videoId = "dQw4w9WgXcQ"; // placeholder

  return (
    <div className="mt-6">
      <YouTube videoId={videoId} opts={{ width: "800", height: "450" }} />
    </div>
  );
}
