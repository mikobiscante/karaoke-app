import { useRouter } from 'next/router';
import Player from '../../components/Player';
import MobileControls from '../../components/MobileControls';
import ScoreDisplay from '../../components/ScoreDisplay';

export default function Room() {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = router.query.mobile === 'true';

  return (
    <div className="bg-black min-h-screen text-white">
      {isMobile ? (
        <MobileControls roomId={id} />
      ) : (
        <div className="flex flex-col items-center">
          <h1 className="text-3xl mt-4">Room: {id}</h1>
          <Player roomId={id} />
          <ScoreDisplay roomId={id} />
        </div>
      )}
    </div>
  );
}
