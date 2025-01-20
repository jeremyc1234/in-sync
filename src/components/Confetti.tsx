import React from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

const Confetti = () => {
    const explodeProps = {
        force: 2,
        duration: 5000,
        particleCount: 200,
        floorHeight: 6000,
        floorWidth: 1600
    };

    return (
        <div className="fixed left-1/2 bottom-0 -translate-x-1/2 pointer-events-none z-50">
            <ConfettiExplosion {...explodeProps} />
        </div>
    );
};

export default Confetti;