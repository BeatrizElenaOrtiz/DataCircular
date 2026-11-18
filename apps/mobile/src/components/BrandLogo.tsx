import React from 'react';
import { Image, ImageStyle } from 'react-native';

interface BrandLogoProps {
  variant: 'dark' | 'light';
  style: ImageStyle;
}

const LOGO_SOURCES = {
  dark: require('../../../../img/IMG_0101.PNG'),
  light: require('../../../../img/IMG_0102.PNG'),
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ variant, style }) => (
  <Image
    accessible
    accessibilityLabel="Fundación IMARA"
    resizeMode="cover"
    source={LOGO_SOURCES[variant]}
    style={style}
  />
);
