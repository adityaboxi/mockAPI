import { useEffect } from 'react';

export default function TitleUpdater() {
  useEffect(() => {
    document.title = 'Telemetry – MockAPI Observability';
  }, []);

  return null;
}