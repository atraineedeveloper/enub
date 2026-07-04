import { Component, type ErrorInfo, type ReactNode } from "react";
import styled from "styled-components";
import Button from "./Button";

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.4rem;
  min-height: 40vh;
  padding: 4rem;
  text-align: center;
`;

const ErrorTitle = styled.h2`
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-grey-700);
`;

const ErrorDetail = styled.p`
  font-size: 1.4rem;
  color: var(--color-red-700);
  background-color: var(--color-red-100);
  padding: 1.2rem 1.6rem;
  border-radius: var(--border-radius-sm);
  max-width: 60rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1.2rem;
`;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorContainer>
          <ErrorTitle>Algo salió mal</ErrorTitle>
          {this.state.error?.message && (
            <ErrorDetail>{this.state.error.message}</ErrorDetail>
          )}
          <ButtonGroup>
            <Button onClick={this.handleReset}>Intentar de nuevo</Button>
            <Button
              variation="secondary"
              onClick={() => window.location.assign("/")}
            >
              Ir al inicio
            </Button>
          </ButtonGroup>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
