import React, { useState } from 'react';
import './Button.css';
import '../pages/GuardianView.css'; // Reusing existing styles

const GuardianControls = ({
    requests,
    connectedAnsim,
    alerts,
    onApprove,
    onReject,
    onDisconnect,
    onGenerateSummary,
    summaryData,
    isGeneratingSummary,
    setSummaryData
}) => {
    const pendingRequests = requests.filter(r => r.status === 'pending');

    return (
        <div className="guardian-sidebar">
            <div className="control-section">
                <h3>연결 요청</h3>
                {pendingRequests.length === 0 ? (
                    <div className="empty-state">새로운 연결 요청이 없습니다.</div>
                ) : (
                    <div className="requests-list">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="request-item">
                                <div className="request-info">
                                    <span>{req.ansimEmail}</span>
                                </div>
                                <div className="request-actions">
                                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => onApprove(req.id)}>수락</button>
                                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => onReject(req.id)}>거절</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="control-section">
                <h3>모니터링 상태</h3>
                {connectedAnsim ? (
                    <div className="connected-status">
                        <div className="connected-user-info" style={{ marginBottom: '16px' }}>
                            <span>연결됨: {connectedAnsim.ansimEmail}</span>
                            <span className="status-dot active"></span>
                        </div>
                        <button className="btn btn-danger btn-block" onClick={() => onDisconnect(connectedAnsim)}>
                            연결 해제
                        </button>
                    </div>
                ) : (
                    <div className="empty-state">
                        현재 연결된 안심이 사용자가 없습니다.
                    </div>
                )}
            </div>

            <div className="control-section">
                <h3>AI 안부 리포트</h3>
                {!connectedAnsim ? (
                    <div className="empty-state">안심이와 연결되면 리포트를 볼 수 있습니다.</div>
                ) : (
                    <>
                        {!summaryData && !isGeneratingSummary && (
                            <button
                                className="btn btn-primary btn-block"
                                onClick={onGenerateSummary}
                                style={{ background: 'linear-gradient(to right, #4f46e5, #818cf8)', border: 'none' }}
                            >
                                ✨ 오늘의 활동 분석하기
                            </button>
                        )}

                        {isGeneratingSummary && (
                            <div className="ai-loading">
                                <div className="spinner-sm"></div>
                                <span>AI가 하루를 분석하고 있어요...</span>
                            </div>
                        )}

                        {summaryData && (
                            <div className="ai-summary-card">
                                <div className="ai-summary-header">
                                    <span className="ai-badge">AI</span>
                                    <span>오늘의 요약</span>
                                </div>
                                <div className="ai-summary-content">
                                    {summaryData}
                                </div>
                                <button
                                    className="btn btn-secondary btn-sm btn-block"
                                    style={{ marginTop: '12px' }}
                                    onClick={() => setSummaryData(null)}
                                >
                                    닫기
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="control-section">
                <h3>알림</h3>
                {alerts.length === 0 ? (
                    <div className="empty-state">새로운 알림이 없습니다.</div>
                ) : (
                    <div className="alerts-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {alerts.map(alert => (
                            <div key={alert.id} className="alert-item" style={{
                                padding: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--color-danger)',
                                borderRadius: 'var(--border-radius-md)',
                                fontSize: '0.875rem'
                            }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--color-danger)', marginBottom: '4px' }}>
                                    ⚠️ 안심지역 이탈 감지!
                                </div>
                                <div style={{ color: 'var(--color-text-main)' }}>
                                    {new Date(alert.time).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GuardianControls;
