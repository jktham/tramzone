{{/* Generate basic labels */}}
{{- define "ivia.labels" }}
app.kubernetes.io/name: {{ template "ivia-course-microservice-chart.fullname" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}

{{- define "nginx.annotations" }}
cert-manager.io/cluster-issuer: letsencrypt-prod
{{- end }}

{{- define "ivia-course-microservice-chart.fullname" -}}
{{- if .Values.nameSuffix -}}
{{- printf "%s-%s" .Release.Name .Values.nameSuffix | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}