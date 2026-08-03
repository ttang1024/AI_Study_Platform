import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Award from 'lucide-react-native/icons/award';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { SHARE_BASE_URL } from '@/constants/env';
import { Colors, Layout, Spacing, Typography } from '@/constants/theme';
import {
  certificateService,
  certificateShareUrl,
  type Certificate,
  type CertificateEligibility,
} from '@/services/certificateService';
import { getApiErrorMessage } from '@/utils/apiError';

export default function CertificatesScreen() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [eligibility, setEligibility] = useState<CertificateEligibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [mine, elig] = await Promise.all([
        certificateService.getMine(),
        certificateService.getEligibility(),
      ]);
      setCertificates(mine.data.data);
      setEligibility(elig.data.data);
    } catch {
      setError('Could not load your certificates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const act = async (id: string, action: () => Promise<void>, fallback: string) => {
    setBusyId(id); setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, fallback));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  // Issued courses drop out of the progress list — there is nothing left to work toward there.
  const inProgress = eligibility.filter((e) => !e.alreadyIssued);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.row}>
        <Award size={22} color={Colors.amber} />
        <Text style={styles.title}>Your certificates</Text>
      </View>

      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          subtitle="Reach 80% mastery on a course to earn your first one."
          bordered
        />
      ) : (
        certificates.map((certificate) => (
          <Card key={certificate.courseCertificateId} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{certificate.courseName}</Text>
              <Text style={styles.score}>{certificate.masteryScore}%</Text>
            </View>
            <Text style={styles.meta}>
              {certificate.recipientName} · {new Date(certificate.issuedAt).toLocaleDateString()}
              {certificate.revokedAt ? ' · withdrawn' : ''}
            </Text>
            {!certificate.revokedAt && (
              <>
                <Button
                  title="Copy share link"
                  variant="secondary"
                  onPress={() =>
                    Clipboard.setStringAsync(
                      certificateShareUrl(SHARE_BASE_URL, certificate.publicToken),
                    )
                  }
                />
                <Button
                  title="Withdraw"
                  variant="danger"
                  loading={busyId === certificate.courseCertificateId}
                  onPress={() =>
                    act(
                      certificate.courseCertificateId,
                      async () => {
                        await certificateService.revoke(certificate.courseCertificateId);
                      },
                      'Could not withdraw that certificate.',
                    )
                  }
                />
              </>
            )}
          </Card>
        ))
      )}

      {inProgress.length > 0 && (
        <>
          <Text style={[styles.title, styles.sectionGap]}>Progress toward the next one</Text>
          {inProgress.map((course) => (
            <Card key={course.courseId} style={styles.card}>
              <Text style={styles.cardTitle}>{course.courseName}</Text>
              <ProgressBar
                progress={Math.min(1, course.masteryScore / course.requiredScore)}
                color={course.isEligible ? Colors.amber : Colors.primary}
              />
              <Text style={styles.meta}>
                {course.masteryScore}% of {course.requiredScore}% needed
              </Text>
              <Button
                title="Claim"
                disabled={!course.isEligible}
                loading={busyId === course.courseId}
                onPress={() =>
                  act(
                    course.courseId,
                    async () => {
                      await certificateService.issue(course.courseId);
                    },
                    'Could not issue that certificate.',
                  )
                }
              />
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  row: { ...Layout.row, gap: Spacing.two },
  rowBetween: { ...Layout.rowBetween },
  sectionGap: { marginTop: Spacing.four },
  title: { ...Typography.heading, color: Colors.textPrimary },
  card: { gap: Spacing.two },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary, flexShrink: 1 },
  score: { ...Typography.captionBold, color: Colors.amber },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  error: { ...Typography.caption, color: Colors.errorText },
});
