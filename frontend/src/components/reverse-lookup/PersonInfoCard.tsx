import React from 'react';
import { User, MapPin, Phone, Mail, Link as LinkIcon, Calendar, Building } from 'lucide-react';

interface PersonInfo {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    aliases?: string[];
    age?: number;
    dateOfBirth?: string;
    addresses?: Array<{ fullAddress?: string; city?: string; state?: string; country?: string }>;
    phoneNumbers?: string[];
    emailAddresses?: string[];
    socialProfiles?: Array<{ platform: string; username?: string; url: string; verified?: boolean }>;
    profession?: string;
    company?: string;
    education?: string[];
    languages?: string[];
}

interface PersonInfoCardProps {
    personInfo: PersonInfo;
}

export const PersonInfoCard: React.FC<PersonInfoCardProps> = ({ personInfo }) => {
    if (!personInfo) {
        return null;
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-accent-primary/20 flex items-center justify-center">
                    <User className="w-8 h-8 text-accent-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-text-primary">{personInfo.fullName || 'Unknown Person'}</h3>
                    {personInfo.aliases && personInfo.aliases.length > 0 && (
                        <p className="text-sm text-text-secondary mt-1">
                            Also known as: {personInfo.aliases.join(', ')}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                    {personInfo.age && (
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">Age: {personInfo.age}</span>
                        </div>
                    )}
                    {personInfo.dateOfBirth && (
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">DOB: {personInfo.dateOfBirth}</span>
                        </div>
                    )}
                    {personInfo.profession && (
                        <div className="flex items-center gap-2 text-text-secondary">
                            <User className="w-4 h-4" />
                            <span className="text-sm">{personInfo.profession}</span>
                        </div>
                    )}
                    {personInfo.company && (
                        <div className="flex items-center gap-2 text-text-secondary">
                            <Building className="w-4 h-4" />
                            <span className="text-sm">{personInfo.company}</span>
                        </div>
                    )}
                </div>

                {/* Addresses */}
                {personInfo.addresses && personInfo.addresses.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Addresses
                        </h4>
                        <ul className="space-y-1">
                            {personInfo.addresses.map((addr, idx) => (
                                <li key={idx} className="text-sm text-text-secondary pl-6">
                                    {addr.fullAddress || `${addr.city || ''}, ${addr.state || ''} ${addr.country || ''}`.trim()}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Phone Numbers */}
                {personInfo.phoneNumbers && personInfo.phoneNumbers.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Numbers
                        </h4>
                        <ul className="space-y-1">
                            {personInfo.phoneNumbers.map((phone, idx) => (
                                <li key={idx} className="text-sm text-text-secondary pl-6">
                                    <a href={`tel:${phone}`} className="text-accent-primary hover:underline">
                                        {phone}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Email Addresses */}
                {personInfo.emailAddresses && personInfo.emailAddresses.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email Addresses
                        </h4>
                        <ul className="space-y-1">
                            {personInfo.emailAddresses.map((email, idx) => (
                                <li key={idx} className="text-sm text-text-secondary pl-6">
                                    <a href={`mailto:${email}`} className="text-accent-primary hover:underline">
                                        {email}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Social Profiles */}
                {personInfo.socialProfiles && personInfo.socialProfiles.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-2 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" />
                            Social Media Profiles
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {personInfo.socialProfiles.map((profile, idx) => (
                                <a
                                    key={idx}
                                    href={profile.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-accent-primary/20 text-accent-primary rounded-full text-sm hover:bg-accent-primary/30 transition-colors"
                                >
                                    {profile.platform}
                                    {profile.verified && (
                                        <span className="text-xs">✓</span>
                                    )}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Education */}
                {personInfo.education && personInfo.education.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-2">Education</h4>
                        <ul className="space-y-1">
                            {personInfo.education.map((edu, idx) => (
                                <li key={idx} className="text-sm text-text-secondary pl-6">{edu}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Languages */}
                {personInfo.languages && personInfo.languages.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-2">Languages</h4>
                        <div className="flex flex-wrap gap-2">
                            {personInfo.languages.map((lang, idx) => (
                                <span key={idx} className="px-2 py-1 bg-bg-card border border-glass-border text-text-secondary rounded text-sm">
                                    {lang}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
