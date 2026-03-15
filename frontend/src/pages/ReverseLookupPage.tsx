import React from 'react';
import { ReverseLookupPanel } from '../components/reverse-lookup/ReverseLookupPanel';

const ReverseLookupPage: React.FC = () => {
    return (
        <div className="search-page">
            <div className="search-hero">
                <h2 className="page-title">Reverse Lookup Intelligence</h2>
                <p className="page-subtitle">
                    Perform reverse lookups on phone numbers, email addresses, images, VIN numbers, and addresses
                    to discover associated information, relationships, and web activity.
                </p>
            </div>

            <div className="search-container">
                <ReverseLookupPanel />
            </div>
        </div>
    );
};

export default ReverseLookupPage;
