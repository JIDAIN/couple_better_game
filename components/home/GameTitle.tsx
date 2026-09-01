import { Title } from "animal-island-ui";

export function GameTitle() {
  return (
    <header className="text-center">
      <div className="inline-flex flex-col items-center">
        <Title size="middle" color="app-pink" className="mt-0.5">
          变美变瘦大作战
        </Title>
      </div>
    </header>
  );
}
