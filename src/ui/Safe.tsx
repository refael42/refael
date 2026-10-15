import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { translate } from '../i18n';
import { useSettings } from '../store/settings';

// A screen that fails to draw must not take the app with it (owner: "a few crashes"): without
// this, one error in any panel blanks everything. The game is saved every few seconds, so
// "continue" simply starts the screen again from there.

interface Props {
  children: ReactNode;
}

export class Safe extends Component<Props, { failed: boolean; round: number }> {
  state = { failed: false, round: 0 };

  static getDerivedStateFromError(): Partial<{ failed: boolean }> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.warn('A screen failed and was restarted', error);
  }

  render() {
    if (!this.state.failed) return <View key={this.state.round} style={styles.fill}>{this.props.children}</View>;
    const lang = useSettings.getState().lang;
    return (
      <View style={styles.wrap}>
        <View style={styles.card}>
          <Text style={styles.title}>{translate(lang, 'safe.title')}</Text>
          <Text style={styles.text}>{translate(lang, 'safe.text')}</Text>
          <Pressable accessibilityRole="button" onPress={() => this.setState((s) => ({ failed: false, round: s.round + 1 }))} style={styles.button}>
            <Text style={styles.buttonText}>{translate(lang, 'safe.go')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1022' },
  card: { maxWidth: 420, padding: 20, borderRadius: 18, backgroundColor: 'rgba(42,21,48,0.96)', borderWidth: 2, borderColor: '#E2B13C', alignItems: 'center', gap: 10 },
  title: { color: '#FFE9A8', fontSize: 19, fontWeight: '900' },
  text: { color: '#E8D7F0', fontSize: 14, textAlign: 'center' },
  button: { marginTop: 4, paddingHorizontal: 26, height: 44, borderRadius: 14, backgroundColor: '#3FB25A', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
});
