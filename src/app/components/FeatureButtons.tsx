import React from 'react';
import { FreeTalkIcon, VocabularyIcon, GrammarIcon, ReviewIcon } from './Icons';

type Feature = 'freeTalk' | 'vocabulary' | 'mistakes' | 'grammar';

interface FeatureButtonProps {
  features: { id: Feature; name: string }[];
  currentFeature: Feature;
  onFeatureClick: (feature: Feature) => void;
}

const FeatureButtons: React.FC<FeatureButtonProps> = ({ features, currentFeature, onFeatureClick }) => {
  const getFeatureIcon = (featureId: Feature) => {
    switch (featureId) {
      case 'freeTalk':
        return <FreeTalkIcon />;
      case 'vocabulary':
        return <VocabularyIcon />;
      case 'grammar':
        return <GrammarIcon />;
      case 'mistakes':
        return <ReviewIcon />;
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-center flex-wrap gap-2 p-3 bg-gray-100 border-b border-gray-200 shadow-sm">
      {features.map((feature) => (
        <button
          key={feature.id}
          onClick={() => onFeatureClick(feature.id)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition duration-300 ease-in-out flex items-center gap-1.5 ${currentFeature === feature.id
            ? 'bg-blue-500 text-white shadow-md'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          {getFeatureIcon(feature.id)}
          {feature.name}
        </button>
      ))}
    </div>
  );
};

export default FeatureButtons; 