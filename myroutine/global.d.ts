
import React from 'react';
import {
    ViewProps,
    TextProps,
    TextInputProps,
    ScrollViewProps,
    PressableProps,
    SwitchProps,
    FlatListProps,
    TouchableOpacityProps
} from 'react-native';

declare module 'react-native' {
    // Attempt to merge the missing properties from React.Component into View/Text
    // This addresses the "Type 'View' is missing ... context, setState ..." error
    export interface View extends React.Component<ViewProps> { }
    export interface Text extends React.Component<TextProps> { }
    export interface TextInput extends React.Component<TextInputProps> {
        focus(): void;
        blur(): void;
        clear(): void;
        isFocused(): boolean;
    }
    export interface ScrollView extends React.Component<ScrollViewProps> { }
    export interface Pressable extends React.Component<PressableProps> { }
    export interface Switch extends React.Component<SwitchProps> { }
    export interface FlatList<ItemT = any> extends React.Component<FlatListProps<ItemT>> { }
    export interface TouchableOpacity extends React.Component<TouchableOpacityProps> { }
}

declare module 'invariant';
declare module '@react-native/assets-registry/registry';
declare module 'react-native/Libraries/Image/AssetSourceResolver';
