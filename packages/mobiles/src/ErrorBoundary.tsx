import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 오류 리포트 전송
    this.sendErrorReport(error, errorInfo);
  }

  sendErrorReport = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // 사용자 정보 가져오기
      const mobileUser = await AsyncStorage.getItem('@mobile_user');
      let userInfo = null;
      if (mobileUser) {
        userInfo = JSON.parse(mobileUser);
      }

      // Firestore에 오류 리포트 저장
      await addDoc(collection(db, 'errorReports'), {
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        userInfo: userInfo,
        platform: Platform.OS,
        timestamp: serverTimestamp(),
      });

      // 사용자에게 팝업 표시
      Alert.alert(
        '오류 리포트 전송',
        '오류리포트를 전송하였습니다',
        [{ text: '확인', onPress: () => this.setState({ hasError: false, error: null }) }]
      );
    } catch (reportError) {
      console.error('오류 리포트 전송 실패:', reportError);
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>앱에 오류가 발생했습니다.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ErrorBoundary;

