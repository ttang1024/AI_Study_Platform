import React, { useState } from 'react';
import { Flashcard } from '../../types';
import { FlashcardFlipCard } from './FlashcardFlipCard';

interface HardFlashcardCardProps {
  card: Flashcard;
}

export const HardFlashcardCard: React.FC<HardFlashcardCardProps> = ({ card }) => {
  const [flipped, setFlipped] = useState(false);
  const sourceName = card.documentName ?? card.videoName;

  return (
    <FlashcardFlipCard
      front={card.front}
      back={card.back}
      cardType={card.cardType}
      isFlipped={flipped}
      onFlip={() => setFlipped(f => !f)}
      compact
      sourceName={sourceName ?? undefined}
    />
  );
};
