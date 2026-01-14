import React from 'react';

const CyberpunkDog: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <svg
            viewBox="0 0 100 100"
            className={className}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* 
          Professional Greyhound Head Silhouette
          Clean, iconic, and bold. Designed to look good with blur.
      */}
            <path
                d="M10,80 
           C15,65 20,40 35,30 
           C45,22 60,15 75,18 
           C85,20 95,30 98,45 
           C100,60 90,75 75,80 
           C60,85 30,90 10,80 Z"
            />
            {/* Ear - Sharp and iconic */}
            <path
                d="M45,25 L55,5 L65,22 Z"
            />
            {/* Snout detail */}
            <path
                d="M85,45 Q95,48 98,55 L90,58 Z"
                opacity="0.5"
            />
        </svg>
    );
};

export default CyberpunkDog;
